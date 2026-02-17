import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";
import { rankSubreddits } from "@/lib/recommendations/ranking";
import {
  candidateSubredditNamesForProject,
  computeSubredditTimeWindows,
  ingestSubreddit,
} from "@/lib/subreddit/intel";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function uniqueSubredditNames(names: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }
  return deduped;
}

async function fetchPersistedRecommendations(workspaceId: string, projectId: string) {
  return prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId,
      projectId,
      status: { in: ["SELECTED", "CANDIDATE"] },
    },
    select: {
      subredditId: true,
      fitScore: true,
      riskScore: true,
      timeWindowScore: true,
      compositeScore: true,
      reasons: true,
      subreddit: {
        select: { name: true, title: true },
      },
    },
    orderBy: [{ compositeScore: "desc" }],
    take: 5,
  });
}

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const projectId = ctx.params.id;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      niche: true,
      goals: true,
      constraints: true,
    },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const selectedRows = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: "SELECTED",
    },
    select: { subredditId: true },
  });
  const selectedSubredditIds = new Set(selectedRows.map((row) => row.subredditId));

  const names = uniqueSubredditNames(
    candidateSubredditNamesForProject({
      projectName: project.name,
      niche: project.niche,
    }),
  );

  const ingestedResults = await Promise.all(
    names.map(async (name) => {
      try {
        await enqueueSubredditIngestJob({ subredditName: name }).catch(
          () => null,
        );
        const subreddit = await ingestSubreddit(name);
        await enqueueSubredditComputeTimeWindowsJob({
          subredditId: subreddit.id,
        }).catch(() => null);
        await computeSubredditTimeWindows(subreddit.id);
        return subreddit;
      } catch {
        return null;
      }
    }),
  );

  const ingested = ingestedResults.filter(
    (
      subreddit,
    ): subreddit is Awaited<ReturnType<typeof ingestSubreddit>> =>
      subreddit !== null,
  );
  if (ingested.length === 0) {
    const persisted = await fetchPersistedRecommendations(
      session.workspaceId,
      projectId,
    );
    const items = persisted.map((item) => ({
      subredditId: item.subredditId,
      subredditName: item.subreddit.name,
      subredditTitle: item.subreddit.title,
      fitScore: item.fitScore,
      riskScore: item.riskScore,
      timeScore: item.timeWindowScore,
      totalScore: item.compositeScore,
      reasons: item.reasons,
    }));

    return NextResponse.json({
      projectId,
      count: items.length,
      items,
    });
  }

  const subredditIds = Array.from(new Set(ingested.map((s) => s.id)));
  const subredditRows = await prisma.subredditCatalog.findMany({
    where: { id: { in: subredditIds } },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      subscribers: true,
      activeUsers: true,
      avgPostsPerDay: true,
      avgCommentsPerPost: true,
      policy: {
        select: {
          promoAllowed: true,
          linkPolicy: true,
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
      },
      timeSlots: {
        orderBy: [{ score: "desc" }],
        take: 1,
        select: { score: true },
      },
    },
  });

  const ranked = rankSubreddits(
    {
      niche: project.niche,
      goals: project.goals,
      constraints: project.constraints,
    },
    subredditRows.map((sub) => ({
      ...sub,
      bestTimeScore: sub.timeSlots[0]?.score ?? 0,
    })),
    5,
  );

  const selectedRanked = ranked.filter((rec) =>
    selectedSubredditIds.has(rec.subredditId),
  );
  const candidateLimit = Math.max(0, 5 - selectedSubredditIds.size);
  const candidateRanked = ranked
    .filter((rec) => !selectedSubredditIds.has(rec.subredditId))
    .slice(0, candidateLimit);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.projectSubredditRecommendation.deleteMany({
      where: {
        workspaceId: session.workspaceId,
        projectId,
        status: { not: "SELECTED" },
      },
    });
    for (const rec of selectedRanked) {
      await tx.projectSubredditRecommendation.updateMany({
        where: {
          workspaceId: session.workspaceId,
          projectId,
          subredditId: rec.subredditId,
          status: "SELECTED",
        },
        data: {
          fitScore: rec.fitScore,
          riskScore: rec.riskScore,
          timeWindowScore: rec.timeScore,
          compositeScore: rec.totalScore,
          reasons: rec.reasons as Prisma.InputJsonValue,
          dismissedAt: null,
        },
      });
    }
    if (candidateRanked.length === 0) return;

    await tx.projectSubredditRecommendation.createMany({
      data: candidateRanked.map((rec) => ({
        workspaceId: session.workspaceId,
        projectId,
        subredditId: rec.subredditId,
        fitScore: rec.fitScore,
        riskScore: rec.riskScore,
        timeWindowScore: rec.timeScore,
        compositeScore: rec.totalScore,
        reasons: rec.reasons as Prisma.InputJsonValue,
        status: "CANDIDATE",
      })),
      skipDuplicates: true,
    });
  });

  const persisted = await fetchPersistedRecommendations(
    session.workspaceId,
    projectId,
  );

  const items = persisted.map((item) => ({
    subredditId: item.subredditId,
    subredditName: item.subreddit.name,
    subredditTitle: item.subreddit.title,
    fitScore: item.fitScore,
    riskScore: item.riskScore,
    timeScore: item.timeWindowScore,
    totalScore: item.compositeScore,
    reasons: item.reasons,
  }));

  return NextResponse.json({
    projectId,
    count: items.length,
    items,
  });
}
