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
  name: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^(r\/)?[A-Za-z0-9_]+$/, "Invalid subreddit format"),
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
    try {
      await enqueueSubredditIngestJob({ subredditName: name });
      queued = true;
    } catch {
      queued = false;
    }
    return NextResponse.json({
      queued,
      message: queued
        ? "Subreddit not in cache yet. Ingest queued."
        : "Subreddit not in cache yet and queue is unavailable. Retry shortly.",
      meta: {
        limit: rl.limit,
        remaining: rl.remaining,
        resetAfterSeconds: rl.resetAfterSeconds,
      },
    });
  }

  const staleHours = Math.floor(
    (Date.now() - subreddit.lastFetchedAt.getTime()) / (1000 * 60 * 60),
  );
  let queueUnavailable = false;
  if (staleHours >= 24) {
    let ingestQueued = false;
    let windowsQueued = false;

    try {
      await enqueueSubredditIngestJob({ subredditName: name });
      ingestQueued = true;
    } catch {
      queueUnavailable = true;
    }

    try {
      await enqueueSubredditComputeTimeWindowsJob({
        subredditId: subreddit.id,
      });
      windowsQueued = true;
    } catch {
      queueUnavailable = true;
    }

    queued = ingestQueued || windowsQueued;
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
    refreshWarning:
      queueUnavailable && !queued
        ? "Refresh queue unavailable; returning cached data."
        : null,
    meta: {
      limit: rl.limit,
      remaining: rl.remaining,
      resetAfterSeconds: rl.resetAfterSeconds,
    },
  });
}
