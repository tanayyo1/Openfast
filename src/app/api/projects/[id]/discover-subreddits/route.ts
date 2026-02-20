import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueSubredditIngestJob } from "@/lib/queue/enqueue";
import { rankSubreddits } from "@/lib/recommendations/ranking";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { candidateSubredditNamesForProject } from "@/lib/subreddit/intel";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";

const querySchema = z.object({
  q: z.string().trim().min(2).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  minSubscribers: z.coerce.number().int().min(0).default(1000),
});

const MAX_QUEUED_INGEST_NAMES = 10;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function tokenizeSearch(input: string | undefined) {
  if (!input) return [];
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

function normalizeSubredditName(input: string) {
  const normalized = input.trim().toLowerCase().replace(/^r\//, "");
  if (!/^[a-z0-9_]{3,21}$/.test(normalized)) return null;
  return normalized;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (!entitlements.hasSmartFinder) {
    return NextResponse.json(
      {
        error: "Smart Finder is available on paid plans",
        code: "SMART_FINDER_REQUIRED",
      },
      { status: 403 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
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

  const tokens = tokenizeSearch(parsed.data.q);
  const searchConditions: Array<Record<string, unknown>> = [];
  const candidateNames = Array.from(
    new Set(
      [
        ...candidateSubredditNamesForProject({
          projectName: project.name,
          niche: project.niche,
        }),
        ...tokens,
      ]
        .map((name) => normalizeSubredditName(name))
        .filter((name): name is string => Boolean(name)),
    ),
  );
  if (candidateNames.length > 0) {
    searchConditions.push({ name: { in: candidateNames } });
  }
  for (const token of tokens) {
    searchConditions.push({
      OR: [
        { name: { contains: token, mode: "insensitive" as const } },
        { title: { contains: token, mode: "insensitive" as const } },
        { description: { contains: token, mode: "insensitive" as const } },
      ],
    });
  }

  const discovered = await prisma.subredditCatalog.findMany({
    where: {
      subscribers: { gte: parsed.data.minSubscribers },
      nsfw: false,
      isRestricted: false,
      isQuarantined: false,
      ...(searchConditions.length > 0 ? { OR: searchConditions } : {}),
    },
    include: {
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
        select: {
          score: true,
          dayOfWeek: true,
          hourUtc: true,
          sampleSize: true,
        },
      },
    },
    orderBy: [{ subscribers: "desc" }, { activeUsers: "desc" }],
    take: 60,
  });

  const foundNames = new Set(
    discovered.map((sub) => normalizeSubredditName(sub.name) ?? sub.name.toLowerCase()),
  );
  const missingInCatalogNames = candidateNames.filter(
    (name) => !foundNames.has(name),
  );
  const queuedIngestNames = missingInCatalogNames.slice(
    0,
    MAX_QUEUED_INGEST_NAMES,
  );
  const queuedIngestNamesDropped =
    missingInCatalogNames.length - queuedIngestNames.length;
  await Promise.all(
    queuedIngestNames.map((name) =>
      enqueueSubredditIngestJob({ subredditName: name }).catch(() => undefined),
    ),
  );

  const ranked = rankSubreddits(
    {
      niche: project.niche,
      goals: project.goals,
      constraints: project.constraints,
    },
    discovered.map((sub) => ({
      ...sub,
      bestTimeScore: sub.timeSlots[0]?.score ?? 0,
    })),
    parsed.data.limit,
  );

  const byId = new Map(ranked.map((r) => [r.subredditId, r]));
  const items = discovered
    .filter((sub) => byId.has(sub.id))
    .map((sub) => {
      const score = byId.get(sub.id)!;
      return {
        subredditId: sub.id,
        name: sub.name,
        title: sub.title,
        description: sub.description,
        subscribers: sub.subscribers,
        activeUsers: sub.activeUsers,
        avgPostsPerDay: sub.avgPostsPerDay,
        avgCommentsPerPost: sub.avgCommentsPerPost,
        policy: sub.policy,
        topTimeWindow: sub.timeSlots[0] ?? null,
        fitScore: score.fitScore,
        riskScore: score.riskScore,
        timeScore: score.timeScore,
        totalScore: score.totalScore,
        reasons: score.reasons,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, parsed.data.limit);

  return NextResponse.json({
    projectId,
    query: parsed.data.q ?? null,
    count: items.length,
    queuedIngestNames,
    queuedIngestNamesTruncated: queuedIngestNamesDropped > 0,
    queuedIngestNamesDropped,
    items,
  });
}
