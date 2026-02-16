import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";

const querySchema = z.object({
  name: z.string().min(2).max(120),
});

export async function GET(req: Request) {
  const userId = await requireSession()
    .then((session) => session.user.id)
    .catch(() => null);
  const rl = await enforcePublicToolRateLimit({
    req,
    tool: "subreddit-analyzer",
    userId,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    name: searchParams.get("name") ?? undefined,
  });
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

  const name = parsed.data.name.toLowerCase().replace(/^r\//, "");

  const subreddit = await prisma.subredditCatalog.findFirst({
    where: { name },
    include: {
      policy: true,
      rules: { orderBy: { fetchedAt: "desc" }, take: 1 },
      timeSlots: { orderBy: { score: "desc" }, take: 5 },
    },
  });

  let queued = false;
  if (!subreddit) {
    await enqueueSubredditIngestJob({ subredditName: name }).catch(
      () => undefined,
    );
    queued = true;
    return NextResponse.json({
      queued,
      message: "Subreddit not in cache yet. Ingest queued.",
      meta: { limit: rl.limit, remaining: rl.remaining },
    });
  }

  const staleHours = Math.floor(
    (Date.now() - subreddit.lastFetchedAt.getTime()) / (1000 * 60 * 60),
  );
  if (staleHours >= 24) {
    await enqueueSubredditIngestJob({ subredditName: name }).catch(
      () => undefined,
    );
    await enqueueSubredditComputeTimeWindowsJob({
      subredditId: subreddit.id,
    }).catch(() => undefined);
    queued = true;
  }

  return NextResponse.json({
    subreddit: {
      id: subreddit.id,
      name: subreddit.name,
      title: subreddit.title,
      subscribers: subreddit.subscribers,
      activeUsers: subreddit.activeUsers,
      nsfw: subreddit.nsfw,
      isRestricted: subreddit.isRestricted,
      isQuarantined: subreddit.isQuarantined,
    },
    policy: subreddit.policy,
    topTimeWindows: subreddit.timeSlots,
    latestRulesFetchedAt: subreddit.rules[0]?.fetchedAt ?? null,
    staleHours,
    queuedRefresh: queued,
    meta: { limit: rl.limit, remaining: rl.remaining },
  });
}
