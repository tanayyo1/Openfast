import { prisma } from "@/lib/prisma";

export type ProjectAnalyticsItem = {
  id: string;
  type: string;
  permalink: string;
  createdAt: Date;
  subreddit: {
    id: string;
    name: string;
    title: string;
  };
  latestSnapshot: {
    score: number;
    upvotes: number;
    downvotes: number;
    upvoteRatio: number | null;
    numComments: number;
    isRemoved: boolean;
    removalReason: string | null;
    capturedAt: Date;
  } | null;
};

export type ProjectAnalyticsSummary = {
  publishedCount: number;
  scheduledCount: number;
  publishingCount: number;
  publishedStatusCount: number;
  failedCount: number;
  cancelledCount: number;
  removedCount: number;
  totalScore: number;
  avgScore: number;
  totalComments: number;
  avgComments: number;
  latestCapturedAt: Date | null;
};

export type ProjectAnalyticsSnapshot = {
  project: {
    id: string;
    name: string;
    status: string;
  };
  summary: ProjectAnalyticsSummary;
  items: ProjectAnalyticsItem[];
};

export async function computeProjectAnalyticsSnapshot(
  workspaceId: string,
  projectId: string,
): Promise<ProjectAnalyticsSnapshot | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true, status: true },
  });
  if (!project) return null;

  const [scheduledStatusCounts, publishedItems] = await Promise.all([
    prisma.scheduledPost.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        draft: { projectId },
      },
      _count: { _all: true },
    }),
    prisma.publishedItem.findMany({
      where: {
        workspaceId,
        scheduledPost: { draft: { projectId } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        permalink: true,
        createdAt: true,
        subreddit: { select: { id: true, name: true, title: true } },
        snapshots: {
          orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            score: true,
            upvotes: true,
            downvotes: true,
            upvoteRatio: true,
            numComments: true,
            isRemoved: true,
            removalReason: true,
            capturedAt: true,
          },
        },
      },
    }),
  ]);

  const statusCounts = scheduledStatusCounts.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    },
    {},
  );

  let totalScore = 0;
  let totalComments = 0;
  let removedCount = 0;
  let latestCapturedAt: Date | null = null;

  const items = publishedItems.map((item) => {
    const latest = item.snapshots[0] ?? null;
    if (latest) {
      totalScore += latest.score;
      totalComments += latest.numComments;
      if (latest.isRemoved) removedCount += 1;
      if (!latestCapturedAt || latest.capturedAt > latestCapturedAt) {
        latestCapturedAt = latest.capturedAt;
      }
    }
    return {
      id: item.id,
      type: item.type,
      permalink: item.permalink,
      subreddit: item.subreddit,
      createdAt: item.createdAt,
      latestSnapshot: latest,
    };
  });

  const publishedCount = items.length;
  return {
    project,
    summary: {
      publishedCount,
      scheduledCount: statusCounts.SCHEDULED ?? 0,
      publishingCount: statusCounts.PUBLISHING ?? 0,
      publishedStatusCount: statusCounts.PUBLISHED ?? 0,
      failedCount:
        (statusCounts.FAILED_RETRYABLE ?? 0) +
        (statusCounts.FAILED_PERMANENT ?? 0),
      cancelledCount: statusCounts.CANCELLED ?? 0,
      removedCount,
      totalScore,
      avgScore: publishedCount ? totalScore / publishedCount : 0,
      totalComments,
      avgComments: publishedCount ? totalComments / publishedCount : 0,
      latestCapturedAt,
    },
    items,
  };
}
