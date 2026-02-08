import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseSubredditRules } from "@/lib/subreddit/rulesParser";

type IngestedSubreddit = {
  name: string;
  title: string;
  description: string;
  subscribers: number;
  activeUsers: number;
  avgPostsPerDay: number;
  avgCommentsPerPost: number;
  rules: string[];
};

const KNOWN_SUBREDDITS: IngestedSubreddit[] = [
  {
    name: "startups",
    title: "Startups",
    description: "Discuss startup strategy, growth, and fundraising",
    subscribers: 1_400_000,
    activeUsers: 5_200,
    avgPostsPerDay: 88,
    avgCommentsPerPost: 16,
    rules: [
      "No blatant self-promo",
      "Share lessons and context",
      "Use correct post flair",
    ],
  },
  {
    name: "entrepreneur",
    title: "Entrepreneur",
    description: "Entrepreneurship stories, validation, and execution",
    subscribers: 2_200_000,
    activeUsers: 9_500,
    avgPostsPerDay: 120,
    avgCommentsPerPost: 11,
    rules: [
      "No affiliate links",
      "Promotional posts must add value",
      "Low-effort posts removed",
    ],
  },
  {
    name: "smallbusiness",
    title: "Small Business",
    description: "Advice and tactics for operating small businesses",
    subscribers: 1_100_000,
    activeUsers: 4_200,
    avgPostsPerDay: 73,
    avgCommentsPerPost: 8,
    rules: [
      "No direct advertising",
      "Be specific and helpful",
      "No misleading claims",
    ],
  },
  {
    name: "saas",
    title: "SaaS",
    description: "Software-as-a-service product and growth discussions",
    subscribers: 180_000,
    activeUsers: 900,
    avgPostsPerDay: 36,
    avgCommentsPerPost: 9,
    rules: [
      "No links in comments when promoting",
      "Must provide context for case studies",
    ],
  },
  {
    name: "marketing",
    title: "Marketing",
    description: "Marketing channels, strategy, and experiments",
    subscribers: 950_000,
    activeUsers: 3_700,
    avgPostsPerDay: 68,
    avgCommentsPerPost: 10,
    rules: ["No spam", "No duplicate posts", "No low-value self promotion"],
  },
];

function seededStats(name: string) {
  const key = name
    .toLowerCase()
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const weekdayBase = (key % 7) + 1;

  return Array.from({ length: 7 * 24 }).map((_, idx) => {
    const day = Math.floor(idx / 24);
    const hour = idx % 24;
    const peak = hour >= 14 && hour <= 20 ? 1 : 0.6;
    const dayAdj =
      (day + weekdayBase) % 7 >= 1 && (day + weekdayBase) % 7 <= 4 ? 1.1 : 0.9;
    const score = Number((peak * dayAdj).toFixed(2));
    const sampleSize = 20 + ((key + idx) % 80);
    return { dayOfWeek: day, hourUtc: hour, score, sampleSize };
  });
}

function pickCatalogData(subredditName: string): IngestedSubreddit {
  const known = KNOWN_SUBREDDITS.find(
    (s) => s.name.toLowerCase() === subredditName.toLowerCase(),
  );
  if (known) return known;

  const normalized = subredditName.replace(/^r\//i, "").toLowerCase();
  return {
    name: normalized,
    title: normalized,
    description: `Community discussions in r/${normalized}`,
    subscribers: 20_000,
    activeUsers: 120,
    avgPostsPerDay: 14,
    avgCommentsPerPost: 4,
    rules: ["No spam", "Be respectful", "Self-promo only if relevant"],
  };
}

export async function ingestSubreddit(subredditName: string) {
  const data = pickCatalogData(subredditName);
  const parsed = parseSubredditRules(data.rules);
  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10));

  const saved = await prisma.$transaction(async (tx) => {
    const subreddit = await tx.subredditCatalog.upsert({
      where: { name: data.name },
      create: {
        name: data.name,
        title: data.title,
        description: data.description,
        subscribers: data.subscribers,
        activeUsers: data.activeUsers,
        avgPostsPerDay: data.avgPostsPerDay,
        avgCommentsPerPost: data.avgCommentsPerPost,
        lastFetchedAt: now,
      },
      update: {
        title: data.title,
        description: data.description,
        subscribers: data.subscribers,
        activeUsers: data.activeUsers,
        avgPostsPerDay: data.avgPostsPerDay,
        avgCommentsPerPost: data.avgCommentsPerPost,
        lastFetchedAt: now,
      },
      select: { id: true, name: true },
    });

    const rule = await tx.subredditRule.findFirst({
      where: { subredditId: subreddit.id },
      orderBy: { fetchedAt: "desc" },
      select: { id: true, parserVersion: true },
    });

    await tx.subredditRule.create({
      data: {
        subredditId: subreddit.id,
        rulesJson: parsed.rulesJson as Prisma.InputJsonValue,
        rawRules: parsed.rawRules,
        fetchedAt: now,
        parserVersion: (rule?.parserVersion ?? 0) + 1,
      },
    });

    await tx.subredditPolicy.upsert({
      where: { subredditId: subreddit.id },
      create: {
        subredditId: subreddit.id,
        promoAllowed: parsed.promoAllowed,
        linkPolicy: parsed.linkPolicy,
        selfPromoAllowed: parsed.selfPromoAllowed,
        affiliateAllowed: parsed.affiliateAllowed,
        flairRequired: parsed.flairRequired,
        textOnly: parsed.textOnly,
        noLinksInPosts: parsed.noLinksInPosts,
        noLinksInComments: parsed.noLinksInComments,
        notes: parsed.notes,
      },
      update: {
        promoAllowed: parsed.promoAllowed,
        linkPolicy: parsed.linkPolicy,
        selfPromoAllowed: parsed.selfPromoAllowed,
        affiliateAllowed: parsed.affiliateAllowed,
        flairRequired: parsed.flairRequired,
        textOnly: parsed.textOnly,
        noLinksInPosts: parsed.noLinksInPosts,
        noLinksInComments: parsed.noLinksInComments,
        notes: parsed.notes,
      },
    });

    await tx.subredditStatsDaily.upsert({
      where: { subredditId_day: { subredditId: subreddit.id, day: today } },
      create: {
        subredditId: subreddit.id,
        day: today,
        postsCount: Math.round(data.avgPostsPerDay),
        avgScore: Math.max(1, data.avgCommentsPerPost * 1.8),
        avgComments: data.avgCommentsPerPost,
        removalRate: parsed.promoAllowed === "DISALLOWED" ? 0.35 : 0.12,
      },
      update: {
        postsCount: Math.round(data.avgPostsPerDay),
        avgScore: Math.max(1, data.avgCommentsPerPost * 1.8),
        avgComments: data.avgCommentsPerPost,
        removalRate: parsed.promoAllowed === "DISALLOWED" ? 0.35 : 0.12,
      },
    });

    return subreddit;
  });

  return saved;
}

export async function computeSubredditTimeWindows(subredditId: string) {
  const subreddit = await prisma.subredditCatalog.findUnique({
    where: { id: subredditId },
    select: { id: true, name: true, avgCommentsPerPost: true },
  });
  if (!subreddit) {
    throw new Error("SUBREDDIT_NOT_FOUND");
  }

  const baseline = Math.max(
    0.2,
    Math.min(1, (subreddit.avgCommentsPerPost ?? 3) / 20),
  );
  const slots = seededStats(subreddit.name).map((slot) => ({
    subredditId,
    dayOfWeek: slot.dayOfWeek,
    hourUtc: slot.hourUtc,
    score: Number((slot.score * baseline).toFixed(4)),
    sampleSize: slot.sampleSize,
  }));

  await prisma.$transaction([
    prisma.subredditTimeSlot.deleteMany({ where: { subredditId } }),
    prisma.subredditTimeSlot.createMany({ data: slots }),
  ]);

  const avgScore =
    slots.reduce((acc, s) => acc + s.score, 0) / Math.max(slots.length, 1);
  return {
    subredditId,
    slotCount: slots.length,
    averageScore: Number(avgScore.toFixed(4)),
  };
}

export function candidateSubredditNamesForProject(input: {
  projectName: string;
  niche: string;
}) {
  const seed = `${input.projectName} ${input.niche}`.toLowerCase();
  const picks = new Set<string>(["startups", "entrepreneur", "smallbusiness"]);
  if (seed.includes("saas") || seed.includes("software")) picks.add("saas");
  if (seed.includes("market")) picks.add("marketing");
  return Array.from(picks);
}
