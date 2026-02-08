import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rankTopSubreddits } from "@/lib/recommendations/ranking";

type RecommendationOutput = {
  id: string;
  workspaceId: string;
  projectId: string;
  subredditId: string;
  fitScore: number;
  riskScore: number;
  timeWindowScore: number;
  compositeScore: number;
  reasons: Prisma.JsonValue;
  status: string;
  selectedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subreddit: {
    id: string;
    name: string;
    title: string;
    subscribers: number;
  };
  ranking: {
    subredditId: string;
    fitScore: number;
    riskScore: number;
    timeWindowScore: number;
    compositeScore: number;
  } | null;
};

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function extractProjectKeywords(project: {
  name: string;
  niche: string;
  description: string;
}) {
  return uniqueStrings([
    ...tokenize(project.name),
    ...tokenize(project.niche),
    ...tokenize(project.description),
  ]).slice(0, 20);
}

function computeFitScore(opts: {
  keywords: string[];
  subreddit: { name: string; title: string; description: string | null };
}) {
  if (opts.keywords.length === 0) return 0.35;
  const haystack =
    `${opts.subreddit.name} ${opts.subreddit.title} ${opts.subreddit.description ?? ""}`.toLowerCase();
  const matches = opts.keywords.filter((keyword) => haystack.includes(keyword));
  const ratio = matches.length / opts.keywords.length;
  return Math.max(0.05, Math.min(1, ratio));
}

function computeRiskScore(opts: {
  subreddit: { nsfw: boolean; isRestricted: boolean; isQuarantined: boolean };
  policy: {
    promoAllowed: "ALLOWED" | "DISALLOWED" | "CONTEXTUAL_ONLY" | "UNKNOWN";
    linkPolicy:
      | "ALLOWED"
      | "DISALLOWED_IN_POSTS"
      | "DISALLOWED_IN_COMMENTS"
      | "DISALLOWED_EVERYWHERE"
      | "UNKNOWN";
    minKarma: number | null;
    minAccountAge: number | null;
  } | null;
}) {
  let risk = 0.15;
  if (opts.subreddit.nsfw) risk += 0.2;
  if (opts.subreddit.isRestricted) risk += 0.2;
  if (opts.subreddit.isQuarantined) risk += 0.3;
  if (opts.policy?.promoAllowed === "DISALLOWED") risk += 0.2;
  if (opts.policy?.linkPolicy === "DISALLOWED_EVERYWHERE") risk += 0.2;
  if (opts.policy?.minKarma && opts.policy.minKarma >= 100) risk += 0.1;
  if (opts.policy?.minAccountAge && opts.policy.minAccountAge >= 30)
    risk += 0.1;
  return Math.max(0, Math.min(1, risk));
}

function computeTimeWindowScore(slotScores: number[]) {
  if (slotScores.length === 0) return 0.5;
  const best = Math.max(...slotScores);
  return Math.max(0, Math.min(1, best));
}

export async function generateProjectRecommendations(input: {
  workspaceId: string;
  projectId: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      workspaceId: input.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      niche: true,
      description: true,
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const keywords = extractProjectKeywords(project);
  const primaryKeyword = keywords[0];

  const subreddits = await prisma.subredditCatalog.findMany({
    where: primaryKeyword
      ? {
          OR: [
            { name: { contains: primaryKeyword, mode: "insensitive" } },
            { title: { contains: primaryKeyword, mode: "insensitive" } },
          ],
        }
      : {},
    include: {
      policy: {
        select: {
          promoAllowed: true,
          linkPolicy: true,
          minKarma: true,
          minAccountAge: true,
        },
      },
      timeSlots: {
        select: { score: true },
        take: 10,
        orderBy: { score: "desc" },
      },
    },
    orderBy: [{ subscribers: "desc" }, { activeUsers: "desc" }],
    take: 30,
  });

  if (subreddits.length === 0) {
    return { project, recommendations: [] as RecommendationOutput[] };
  }

  const ranked = rankTopSubreddits(
    subreddits.map((subreddit) => ({
      subredditId: subreddit.id,
      fitScore: computeFitScore({
        keywords,
        subreddit: {
          name: subreddit.name,
          title: subreddit.title,
          description: subreddit.description,
        },
      }),
      riskScore: computeRiskScore({
        subreddit: {
          nsfw: subreddit.nsfw,
          isRestricted: subreddit.isRestricted,
          isQuarantined: subreddit.isQuarantined,
        },
        policy: subreddit.policy,
      }),
      timeWindowScore: computeTimeWindowScore(
        subreddit.timeSlots.map((slot) => slot.score),
      ),
    })),
    { limit: 5 },
  );

  const scoreMap = new Map(
    ranked.map((item) => [item.subredditId, item] as const),
  );

  await prisma.$transaction(async (tx) => {
    await tx.projectSubredditRecommendation.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
    });

    if (ranked.length === 0) return;

    await tx.projectSubredditRecommendation.createMany({
      data: ranked.map((item) => ({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        subredditId: item.subredditId,
        fitScore: item.fitScore,
        riskScore: item.riskScore,
        timeWindowScore: item.timeWindowScore,
        compositeScore: item.compositeScore,
        reasons: {
          fitScore: item.fitScore,
          riskScore: item.riskScore,
          timeWindowScore: item.timeWindowScore,
          summary:
            item.riskScore > 0.6
              ? "High potential but elevated moderation risk."
              : "Good fit with manageable posting risk.",
        } as Prisma.InputJsonValue,
        status: "CANDIDATE",
      })),
    });
  });

  const recommendations = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    },
    include: {
      subreddit: {
        select: {
          id: true,
          name: true,
          title: true,
          subscribers: true,
        },
      },
    },
    orderBy: [{ compositeScore: "desc" }, { id: "asc" }],
    take: 5,
  });

  return {
    project,
    recommendations: recommendations.map((rec) => ({
      ...rec,
      ranking: scoreMap.get(rec.subredditId) ?? null,
    })) as RecommendationOutput[],
  };
}
