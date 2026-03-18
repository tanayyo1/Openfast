import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";
import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";
import { analyzeSubredditRules } from "@/lib/subreddit/analyzeRules";

const querySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(21)
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

  // Try DB first
  const subreddit = await prisma.subredditCatalog.findUnique({
    where: { name },
    include: {
      policy: true,
      rules: { orderBy: { fetchedAt: "desc" }, take: 1 },
      timeSlots: { orderBy: { score: "desc" }, take: 5 },
    },
  });

  let subredditData: {
    name: string;
    title: string;
    description: string;
    subscribers: number;
    activeUsers: number;
    nsfw: boolean;
    isRestricted: boolean;
    isQuarantined: boolean;
    rules: string[];
  };
  let source: string;
  let topTimeWindows: Array<{
    dayOfWeek: number;
    hourUtc: number;
    score: number;
  }> = [];

  if (subreddit) {
    subredditData = {
      name: subreddit.name,
      title: subreddit.title,
      description: subreddit.description ?? "",
      subscribers: subreddit.subscribers,
      activeUsers: subreddit.activeUsers,
      nsfw: subreddit.nsfw,
      isRestricted: subreddit.isRestricted,
      isQuarantined: subreddit.isQuarantined,
      rules: [],
    };
    source = "database";
    topTimeWindows = subreddit.timeSlots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      hourUtc: s.hourUtc,
      score: Number(s.score),
    }));
  } else {
    // Fetch from Reddit inline
    let fetched;
    try {
      fetched = await fetchSubredditDataWithCache(name);
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not fetch subreddit data. Check the name and try again.",
          code: "FETCH_FAILED",
        },
        { status: 502 },
      );
    }

    subredditData = {
      name: fetched.data.name,
      title: fetched.data.title,
      description: fetched.data.description,
      subscribers: fetched.data.subscribers,
      activeUsers: fetched.data.activeUsers,
      nsfw: fetched.data.nsfw,
      isRestricted: fetched.data.isRestricted,
      isQuarantined: fetched.data.isQuarantined,
      rules: fetched.data.rules,
    };
    source = fetched.source;
  }

  // Run AI analysis on the rules
  const analysis = await analyzeSubredditRules({
    subredditName: subredditData.name,
    subscribers: subredditData.subscribers,
    description: subredditData.description,
    rules: subredditData.rules,
    isRestricted: subredditData.isRestricted,
    isQuarantined: subredditData.isQuarantined,
    nsfw: subredditData.nsfw,
  }).catch(() => null);

  return NextResponse.json({
    subreddit: {
      name: subredditData.name,
      title: subredditData.title,
      subscribers: subredditData.subscribers,
      activeUsers: subredditData.activeUsers,
      nsfw: subredditData.nsfw,
      isRestricted: subredditData.isRestricted,
      isQuarantined: subredditData.isQuarantined,
    },
    analysis,
    rules: subredditData.rules,
    topTimeWindows,
    source,
    meta: {
      limit: rl.limit,
      remaining: rl.remaining,
      resetAfterSeconds: rl.resetAfterSeconds,
    },
  });
}
