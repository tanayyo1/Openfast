import { CandidateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractPainPointCandidates } from "@/lib/painPoints/extract";

export type GeneratedPainPointItem = Prisma.ProjectPainPointGetPayload<{
  include: {
    subreddit: {
      select: { id: true; name: true; title: true };
    };
  };
}>;

function cappedTake(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value as number)));
}

const MAX_RECOMMENDATION_SUBREDDITS = 8;
const MAX_THREADS_PER_SUBREDDIT = 40;

export async function generateProjectPainPoints(input: {
  workspaceId: string;
  projectId: string;
  perSubredditLimit?: number;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      workspaceId: input.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true, name: true },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const selectedRecommendationSubreddits =
    await prisma.projectSubredditRecommendation.findMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        status: "SELECTED",
      },
      select: {
        subredditId: true,
        status: true,
      },
      orderBy: [{ compositeScore: "desc" }],
      take: MAX_RECOMMENDATION_SUBREDDITS,
    });
  const remainingRecommendationSlots = Math.max(
    0,
    MAX_RECOMMENDATION_SUBREDDITS - selectedRecommendationSubreddits.length,
  );
  const candidateRecommendationSubreddits =
    remainingRecommendationSlots > 0
      ? await prisma.projectSubredditRecommendation.findMany({
          where: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            status: "CANDIDATE",
          },
          select: {
            subredditId: true,
            status: true,
          },
          orderBy: [{ compositeScore: "desc" }],
          take: remainingRecommendationSlots,
        })
      : [];
  const activeRecommendationSubreddits = [
    ...selectedRecommendationSubreddits,
    ...candidateRecommendationSubreddits,
  ];

  if (activeRecommendationSubreddits.length === 0) {
    await prisma.projectPainPoint.deleteMany({
      where: { workspaceId: input.workspaceId, projectId: input.projectId },
    });
    return {
      project,
      extracted: 0,
      subreddits: 0,
      items: [] as GeneratedPainPointItem[],
    };
  }

  const subredditIds = activeRecommendationSubreddits.map((item) => item.subredditId);
  const threadBuckets = await Promise.all(
    subredditIds.map(async (subredditId) => {
      const items = await prisma.threadCandidate.findMany({
        where: {
          subredditId,
          status: CandidateStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        select: {
          subredditId: true,
          redditId: true,
          title: true,
          score: true,
          relevanceScore: true,
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: MAX_THREADS_PER_SUBREDDIT,
      });
      return [subredditId, items] as const;
    }),
  );
  const bySubreddit = new Map<string, Array<(typeof threadBuckets)[number][1][number]>>(
    threadBuckets,
  );

  const perSubredditLimit = cappedTake(input.perSubredditLimit, 6, 12);
  const flattened: Array<{
    subredditId: string;
    phrase: string;
    normalizedPhrase: string;
    severityScore: number;
    confidenceScore: number;
    frequency: number;
    sampleTitles: string[];
    sourceThreadIds: string[];
  }> = [];

  for (const subredditId of subredditIds) {
    const source = bySubreddit.get(subredditId) ?? [];
    if (source.length === 0) continue;

    const candidates = extractPainPointCandidates(
      source.map((item) => ({
        redditId: item.redditId,
        title: item.title,
        score: item.score,
        relevanceScore: item.relevanceScore,
      })),
    ).slice(0, perSubredditLimit);

    for (const candidate of candidates) {
      flattened.push({
        subredditId,
        ...candidate,
      });
    }
  }

  if (flattened.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.projectPainPoint.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
        },
      });

      await tx.projectPainPoint.createMany({
        data: flattened.map((item) => ({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          subredditId: item.subredditId,
          phrase: item.phrase,
          normalizedPhrase: item.normalizedPhrase,
          severityScore: item.severityScore,
          confidenceScore: item.confidenceScore,
          frequency: item.frequency,
          evidenceCount: item.sourceThreadIds.length,
          sampleTitles: item.sampleTitles as Prisma.InputJsonValue,
          sourceThreadIds: item.sourceThreadIds as Prisma.InputJsonValue,
          status: CandidateStatus.ACTIVE,
          expiresAt: null,
        })),
      });
    });
  }

  const items: GeneratedPainPointItem[] = await prisma.projectPainPoint.findMany({
    where: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      status: CandidateStatus.ACTIVE,
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [
      { frequency: "desc" },
      { severityScore: "desc" },
      { confidenceScore: "desc" },
    ],
    take: 50,
  });

  return {
    project,
    extracted: items.length,
    subreddits: new Set(items.map((item) => item.subredditId)).size,
    items,
  };
}
