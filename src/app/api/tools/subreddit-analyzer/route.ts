import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";
import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";

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

  if (subreddit) {
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
      staleHours: Math.floor(
        (Date.now() - subreddit.lastFetchedAt.getTime()) / (1000 * 60 * 60),
      ),
      source: "database",
      meta: {
        limit: rl.limit,
        remaining: rl.remaining,
        resetAfterSeconds: rl.resetAfterSeconds,
      },
    });
  }

  // No DB record — fetch inline via .json endpoints (works without Reddit API)
  let fetched;
  try {
    fetched = await fetchSubredditDataWithCache(name);
  } catch {
    return NextResponse.json(
      {
        error: "Could not fetch subreddit data. Check the name and try again.",
        code: "FETCH_FAILED",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    subreddit: {
      id: null,
      name: fetched.data.name,
      title: fetched.data.title,
      subscribers: fetched.data.subscribers,
      activeUsers: fetched.data.activeUsers,
      nsfw: fetched.data.nsfw,
      isRestricted: fetched.data.isRestricted,
      isQuarantined: fetched.data.isQuarantined,
    },
    policy: {
      promoAllowed: null,
      linkPolicy: null,
      flairRequired: false,
      noLinksInPosts: false,
      textOnly: false,
    },
    rules: fetched.data.rules,
    topTimeWindows: [],
    latestRulesFetchedAt: null,
    staleHours: 0,
    source: fetched.source,
    meta: {
      limit: rl.limit,
      remaining: rl.remaining,
      resetAfterSeconds: rl.resetAfterSeconds,
    },
  });
}
