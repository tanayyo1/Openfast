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

  const names = candidateSubredditNamesForProject({
    projectName: project.name,
    niche: project.niche,
  });

  const ingested = await Promise.all(
    names.map(async (name) => {
      await enqueueSubredditIngestJob({ subredditName: name }).catch(
        () => null,
      );
      const subreddit = await ingestSubreddit(name);
      await enqueueSubredditComputeTimeWindowsJob({
        subredditId: subreddit.id,
      }).catch(() => null);
      await computeSubredditTimeWindows(subreddit.id);
      return subreddit;
    }),
  );

  const subredditIds = ingested.map((s) => s.id);
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

  const byId = new Map(ranked.map((r) => [r.subredditId, r]));
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.projectSubredditRecommendation.deleteMany({
      where: { workspaceId: session.workspaceId, projectId },
    });
    if (ranked.length === 0) return;

    await tx.projectSubredditRecommendation.createMany({
      data: ranked.map((rec, index) => ({
        workspaceId: session.workspaceId,
        projectId,
        subredditId: rec.subredditId,
        fitScore: rec.fitScore,
        riskScore: rec.riskScore,
        reasons: {
          points: rec.reasons,
          timeWindowScore: rec.timeScore,
          compositeScore: rec.totalScore,
        } as Prisma.InputJsonValue,
        rank: index + 1,
        status: "CANDIDATE",
      })),
    });
  });

  const items = subredditRows
    .filter((s) => byId.has(s.id))
    .map((s) => {
      const rec = byId.get(s.id)!;
      return {
        subredditId: s.id,
        subredditName: s.name,
        subredditTitle: s.title,
        fitScore: rec.fitScore,
        riskScore: rec.riskScore,
        timeScore: rec.timeScore,
        totalScore: rec.totalScore,
        reasons: rec.reasons,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json({
    projectId,
    count: items.length,
    items,
  });
}
