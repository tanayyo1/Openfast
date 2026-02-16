import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseSubredditRules } from "@/lib/subreddit/rulesParser";
import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";

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

export async function ingestSubreddit(subredditName: string) {
  const { data } = await fetchSubredditDataWithCache(subredditName);
  const parsed = parseSubredditRules(data.rules);
  const now = new Date();

  const saved = await prisma.$transaction(async (tx) => {
    const subreddit = await tx.subredditCatalog.upsert({
      where: { name: data.name },
      create: {
        name: data.name,
        title: data.title,
        description: data.description,
        subscribers: data.subscribers,
        activeUsers: data.activeUsers,
        nsfw: data.nsfw,
        isRestricted: data.isRestricted,
        isQuarantined: data.isQuarantined,
        avgPostsPerDay: data.avgPostsPerDay,
        avgCommentsPerPost: data.avgCommentsPerPost,
        lastFetchedAt: now,
      },
      update: {
        title: data.title,
        description: data.description,
        subscribers: data.subscribers,
        activeUsers: data.activeUsers,
        nsfw: data.nsfw,
        isRestricted: data.isRestricted,
        isQuarantined: data.isQuarantined,
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
