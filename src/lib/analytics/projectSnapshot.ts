import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getProjectDailyPerformanceTrend,
  type DailyPerformancePoint,
} from "@/lib/analytics/trends";

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
  trend: DailyPerformancePoint[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type ProjectAnalyticsSummaryRow = {
  published_count: number;
  total_score: number;
  total_comments: number;
  removed_count: number;
  latest_captured_at: Date | null;
};

function clampItemLimit(rawLimit: number | undefined) {
  if (!Number.isFinite(rawLimit) || (rawLimit ?? 0) <= 0) return 100;
  return Math.min(200, Math.max(1, Math.floor(rawLimit!)));
}

export async function computeProjectAnalyticsSnapshot(
  workspaceId: string,
  projectId: string,
  input?: {
    itemLimit?: number;
    cursor?: string | null;
    trendDays?: number;
    now?: Date;
  },
): Promise<ProjectAnalyticsSnapshot | null> {
  const itemLimit = clampItemLimit(input?.itemLimit);
  const cursor = input?.cursor ?? null;
  const trendDays = input?.trendDays;
  const trendNow = input?.now;

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true, status: true },
  });
  if (!project) return null;

  const [scheduledStatusCounts, summaryRows, publishedItems, trend] =
    await Promise.all([
      prisma.scheduledPost.groupBy({
        by: ["status"],
        where: {
          workspaceId,
          draft: { projectId },
        },
        _count: { _all: true },
      }),
      prisma.$queryRaw<ProjectAnalyticsSummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(pi.id)::int AS published_count,
        COALESCE(SUM(ls.score), 0)::int AS total_score,
        COALESCE(SUM(ls.num_comments), 0)::int AS total_comments,
        COALESCE(SUM(CASE WHEN ls.is_removed THEN 1 ELSE 0 END), 0)::int AS removed_count,
        MAX(ls.captured_at) AS latest_captured_at
      FROM published_items pi
      INNER JOIN scheduled_posts sp
        ON sp.id = pi.scheduled_post_id
      INNER JOIN drafts d
        ON d.id = sp.draft_id
      LEFT JOIN LATERAL (
        SELECT
          ps.score,
          ps.num_comments,
          ps.is_removed,
          ps.captured_at
        FROM performance_snapshots ps
        WHERE ps.published_item_id = pi.id
        ORDER BY ps.captured_at DESC, ps.id DESC
        LIMIT 1
      ) ls ON true
      WHERE pi.workspace_id = ${workspaceId}
        AND d.project_id = ${projectId}
    `),
      prisma.publishedItem.findMany({
        where: {
          workspaceId,
          scheduledPost: { draft: { projectId } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: itemLimit + 1,
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
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
      getProjectDailyPerformanceTrend(workspaceId, projectId, {
        days: trendDays,
        now: trendNow,
      }),
    ]);

  const statusCounts = scheduledStatusCounts.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    },
    {},
  );

  const summaryRow = summaryRows[0] ?? {
    published_count: 0,
    total_score: 0,
    total_comments: 0,
    removed_count: 0,
    latest_captured_at: null,
  };

  const hasMore = publishedItems.length > itemLimit;
  const visibleItems = hasMore
    ? publishedItems.slice(0, itemLimit)
    : publishedItems;

  const items = visibleItems.map((item) => {
    const latest = item.snapshots[0] ?? null;
    return {
      id: item.id,
      type: item.type,
      permalink: item.permalink,
      subreddit: item.subreddit,
      createdAt: item.createdAt,
      latestSnapshot: latest,
    };
  });

  const publishedCount = summaryRow.published_count;
  const nextCursor = hasMore
    ? (visibleItems[visibleItems.length - 1]?.id ?? null)
    : null;

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
      removedCount: summaryRow.removed_count,
      totalScore: summaryRow.total_score,
      avgScore: publishedCount ? summaryRow.total_score / publishedCount : 0,
      totalComments: summaryRow.total_comments,
      avgComments: publishedCount
        ? summaryRow.total_comments / publishedCount
        : 0,
      latestCapturedAt: summaryRow.latest_captured_at,
    },
    items,
    trend,
    page: {
      limit: itemLimit,
      hasMore,
      nextCursor,
    },
  };
}
