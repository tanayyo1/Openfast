import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MIN_TREND_DAYS = 7;
const MAX_TREND_DAYS = 90;
const DEFAULT_TREND_DAYS = 14;

type DailyTrendRow = {
  day: Date;
  total_score: number;
  total_comments: number;
  removed_count: number;
  active_items: number;
};

export type DailyPerformancePoint = {
  day: string;
  totalScore: number;
  totalComments: number;
  removedCount: number;
  activeItems: number;
};

export function clampTrendDays(rawDays: number | undefined) {
  if (!Number.isFinite(rawDays) || (rawDays ?? 0) <= 0) {
    return DEFAULT_TREND_DAYS;
  }
  const normalized = Math.floor(rawDays!);
  return Math.min(MAX_TREND_DAYS, Math.max(MIN_TREND_DAYS, normalized));
}

function buildTrendWindow(days: number, now: Date) {
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start, end };
}

function mapDailyTrend(rows: DailyTrendRow[]) {
  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    totalScore: row.total_score,
    totalComments: row.total_comments,
    removedCount: row.removed_count,
    activeItems: row.active_items,
  }));
}

export async function getWorkspaceDailyPerformanceTrend(
  workspaceId: string,
  input?: {
    days?: number;
    now?: Date;
  },
): Promise<DailyPerformancePoint[]> {
  const days = clampTrendDays(input?.days);
  const now = input?.now ?? new Date();
  const window = buildTrendWindow(days, now);

  const rows = await prisma.$queryRaw<DailyTrendRow[]>(Prisma.sql`
    WITH series AS (
      SELECT generate_series(${window.start}::date, ${window.end}::date, interval '1 day')::date AS day
    ),
    ranked AS (
      SELECT
        date(ps.captured_at) AS day,
        ps.published_item_id,
        ps.score,
        ps.num_comments,
        ps.is_removed,
        ROW_NUMBER() OVER (
          PARTITION BY ps.published_item_id, date(ps.captured_at)
          ORDER BY ps.captured_at DESC, ps.id DESC
        ) AS rn
      FROM performance_snapshots ps
      INNER JOIN published_items pi
        ON pi.id = ps.published_item_id
      WHERE pi.workspace_id = ${workspaceId}
        AND ps.captured_at >= ${window.start}
        AND ps.captured_at <= ${window.end}
    ),
    daily AS (
      SELECT
        day,
        COALESCE(SUM(score), 0)::int AS total_score,
        COALESCE(SUM(num_comments), 0)::int AS total_comments,
        COALESCE(SUM(CASE WHEN is_removed THEN 1 ELSE 0 END), 0)::int AS removed_count,
        COUNT(*)::int AS active_items
      FROM ranked
      WHERE rn = 1
      GROUP BY day
    )
    SELECT
      series.day AS day,
      COALESCE(daily.total_score, 0)::int AS total_score,
      COALESCE(daily.total_comments, 0)::int AS total_comments,
      COALESCE(daily.removed_count, 0)::int AS removed_count,
      COALESCE(daily.active_items, 0)::int AS active_items
    FROM series
    LEFT JOIN daily
      ON daily.day = series.day
    ORDER BY series.day ASC
  `);

  return mapDailyTrend(rows);
}

export async function getProjectDailyPerformanceTrend(
  workspaceId: string,
  projectId: string,
  input?: {
    days?: number;
    now?: Date;
  },
): Promise<DailyPerformancePoint[]> {
  const days = clampTrendDays(input?.days);
  const now = input?.now ?? new Date();
  const window = buildTrendWindow(days, now);

  const rows = await prisma.$queryRaw<DailyTrendRow[]>(Prisma.sql`
    WITH series AS (
      SELECT generate_series(${window.start}::date, ${window.end}::date, interval '1 day')::date AS day
    ),
    ranked AS (
      SELECT
        date(ps.captured_at) AS day,
        ps.published_item_id,
        ps.score,
        ps.num_comments,
        ps.is_removed,
        ROW_NUMBER() OVER (
          PARTITION BY ps.published_item_id, date(ps.captured_at)
          ORDER BY ps.captured_at DESC, ps.id DESC
        ) AS rn
      FROM performance_snapshots ps
      INNER JOIN published_items pi
        ON pi.id = ps.published_item_id
      INNER JOIN scheduled_posts sp
        ON sp.id = pi.scheduled_post_id
      INNER JOIN drafts d
        ON d.id = sp.draft_id
      WHERE pi.workspace_id = ${workspaceId}
        AND d.project_id = ${projectId}
        AND ps.captured_at >= ${window.start}
        AND ps.captured_at <= ${window.end}
    ),
    daily AS (
      SELECT
        day,
        COALESCE(SUM(score), 0)::int AS total_score,
        COALESCE(SUM(num_comments), 0)::int AS total_comments,
        COALESCE(SUM(CASE WHEN is_removed THEN 1 ELSE 0 END), 0)::int AS removed_count,
        COUNT(*)::int AS active_items
      FROM ranked
      WHERE rn = 1
      GROUP BY day
    )
    SELECT
      series.day AS day,
      COALESCE(daily.total_score, 0)::int AS total_score,
      COALESCE(daily.total_comments, 0)::int AS total_comments,
      COALESCE(daily.removed_count, 0)::int AS removed_count,
      COALESCE(daily.active_items, 0)::int AS active_items
    FROM series
    LEFT JOIN daily
      ON daily.day = series.day
    ORDER BY series.day ASC
  `);

  return mapDailyTrend(rows);
}
