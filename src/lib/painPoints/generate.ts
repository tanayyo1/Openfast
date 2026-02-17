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

  const activeRecommendationSubreddits =
    await prisma.projectSubredditRecommendation.findMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        status: { in: ["SELECTED", "CANDIDATE"] },
      },
      select: {
        subredditId: true,
        status: true,
      },
      orderBy: [{ status: "asc" }, { compositeScore: "desc" }],
      take: 8,
    });

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
  const threadCandidates = await prisma.threadCandidate.findMany({
    where: {
      subredditId: { in: subredditIds },
      status: CandidateStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    select: {
      subredditId: true,
      redditId: true,
      title: true,
      score: true,
      relevanceScore: true,
      subreddit: { select: { id: true, name: true } },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const bySubreddit = new Map<string, typeof threadCandidates>();
  for (const candidate of threadCandidates) {
    const list = bySubreddit.get(candidate.subredditId) ?? [];
    list.push(candidate);
    bySubreddit.set(candidate.subredditId, list);
  }

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

  await prisma.$transaction(async (tx) => {
    await tx.projectPainPoint.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
    });

    if (flattened.length === 0) return;

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
