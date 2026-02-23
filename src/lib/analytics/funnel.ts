import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type FunnelStage = {
  stage: string;
  eventName: string;
  uniqueUsers: number;
  uniqueSessions: number;
  totalEvents: number;
};

export type FunnelDropoff = {
  fromStage: string;
  toStage: string;
  fromCount: number;
  toCount: number;
  dropoffRate: number;
  conversionRate: number;
};

export type FunnelResult = {
  stages: FunnelStage[];
  dropoffs: FunnelDropoff[];
  period: {
    start: Date;
    end: Date;
  };
};

export type TimeToFirstValueMetrics = {
  sampleSize: number;
  avgMinutes: number | null;
  p50Minutes: number | null;
  p90Minutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
};

const FUNNEL_STAGES = [
  { stage: "homepage", eventName: "homepage_view" },
  { stage: "signup_started", eventName: "signup_started" },
  { stage: "signup_completed", eventName: "signup_completed" },
  { stage: "onboarding_completed", eventName: "onboarding_completed" },
  { stage: "plan_activated", eventName: "plan_activated" },
] as const;

export async function getFunnelStages(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
): Promise<FunnelStage[]> {
  const stages: FunnelStage[] = [];

  for (const { stage, eventName } of FUNNEL_STAGES) {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_session_id)) as count
      FROM analytics_events
      WHERE workspace_id = ${workspaceId}
        AND event_name = ${eventName}
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
    `;

    const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE workspace_id = ${workspaceId}
        AND event_name = ${eventName}
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
    `;

    const userResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE workspace_id = ${workspaceId}
        AND event_name = ${eventName}
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
        AND user_id IS NOT NULL
    `;

    stages.push({
      stage,
      eventName,
      uniqueUsers: Number(userResult[0]?.count ?? 0),
      uniqueSessions: Number(result[0]?.count ?? 0),
      totalEvents: Number(totalResult[0]?.count ?? 0),
    });
  }

  return stages;
}

export function calculateDropoffs(stages: FunnelStage[]): FunnelDropoff[] {
  const dropoffs: FunnelDropoff[] = [];

  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];

    const fromCount = from.uniqueSessions;
    const toCount = to.uniqueSessions;

    const dropoffRate =
      fromCount > 0 ? ((fromCount - toCount) / fromCount) * 100 : 0;
    const conversionRate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;

    dropoffs.push({
      fromStage: from.stage,
      toStage: to.stage,
      fromCount,
      toCount,
      dropoffRate: Math.round(dropoffRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
    });
  }

  return dropoffs;
}

export async function getFunnelData(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
): Promise<FunnelResult> {
  const stages = await getFunnelStages(workspaceId, startDate, endDate);
  const dropoffs = calculateDropoffs(stages);

  return {
    stages,
    dropoffs,
    period: { start: startDate, end: endDate },
  };
}

export type EventCountByType = {
  eventName: string;
  count: number;
  uniqueUsers: number;
  uniqueSessions: number;
};

export async function getEventCountsLast24h(
  workspaceId: string,
): Promise<EventCountByType[]> {
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const results = await prisma.$queryRaw<
    {
      event_name: string;
      count: bigint;
      unique_users: bigint;
      unique_sessions: bigint;
    }[]
  >`
    SELECT
      event_name,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT COALESCE(user_id, anonymous_session_id)) as unique_sessions
    FROM analytics_events
    WHERE workspace_id = ${workspaceId}
      AND event_ts >= ${startDate}
      AND event_ts <= ${endDate}
    GROUP BY event_name
    ORDER BY count DESC
  `;

  return results.map((r) => ({
    eventName: r.event_name,
    count: Number(r.count),
    uniqueUsers: Number(r.unique_users),
    uniqueSessions: Number(r.unique_sessions),
  }));
}

export type FullFunnelPath = {
  anonymousSessionId: string | null;
  userId: string | null;
  workspaceId: string | null;
  completedStages: string[];
  completedAt: Date;
};

export async function getFullFunnelPaths(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  limit = 10,
): Promise<FullFunnelPath[]> {
  const results = await prisma.$queryRaw<FullFunnelPath[]>`
    WITH session_stages AS (
      SELECT
        COALESCE(user_id, anonymous_session_id) as session_key,
        user_id,
        anonymous_session_id,
        workspace_id,
        ARRAY_AGG(event_name ORDER BY event_ts ASC) as stages,
        MIN(CASE WHEN event_name = 'homepage_view' THEN event_ts END) as homepage_ts,
        MIN(CASE WHEN event_name = 'signup_completed' THEN event_ts END) as signup_completed_ts,
        MIN(CASE WHEN event_name = 'onboarding_completed' THEN event_ts END) as onboarding_completed_ts,
        MIN(CASE WHEN event_name = 'plan_activated' THEN event_ts END) as plan_activated_ts,
        MAX(event_ts) as completed_at
      FROM analytics_events
      WHERE workspace_id = ${workspaceId}
        AND event_name IN ('homepage_view', 'signup_started', 'signup_completed', 'onboarding_completed', 'plan_activated')
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
      GROUP BY session_key, user_id, anonymous_session_id, workspace_id
    )
    SELECT
      anonymous_session_id,
      user_id,
      workspace_id,
      stages as "completedStages",
      completed_at as "completedAt"
    FROM session_stages
    WHERE homepage_ts IS NOT NULL
      AND signup_completed_ts IS NOT NULL
      AND onboarding_completed_ts IS NOT NULL
      AND plan_activated_ts IS NOT NULL
      AND homepage_ts <= signup_completed_ts
      AND signup_completed_ts <= onboarding_completed_ts
      AND onboarding_completed_ts <= plan_activated_ts
    ORDER BY completed_at DESC
    LIMIT ${limit}
  `;

  return results;
}

type TimeToFirstValueRow = {
  sample_size: bigint;
  avg_seconds: number | null;
  p50_seconds: number | null;
  p90_seconds: number | null;
  min_seconds: number | null;
  max_seconds: number | null;
};

function roundMinutes(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds)) return null;
  return Math.round((seconds / 60) * 100) / 100;
}

export async function getTimeToFirstValueMetrics(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
): Promise<TimeToFirstValueMetrics> {
  const rows = await prisma.$queryRaw<TimeToFirstValueRow[]>`
    WITH journeys AS (
      SELECT
        COALESCE(user_id, anonymous_session_id) AS session_key,
        MIN(CASE WHEN event_name = 'signup_completed' THEN event_ts END) AS signup_completed_ts,
        MIN(CASE WHEN event_name = 'onboarding_completed' THEN event_ts END) AS onboarding_completed_ts
      FROM analytics_events
      WHERE workspace_id = ${workspaceId}
        AND event_name IN ('signup_completed', 'onboarding_completed')
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
      GROUP BY session_key
    )
    SELECT
      COUNT(*)::bigint AS sample_size,
      AVG(EXTRACT(EPOCH FROM (onboarding_completed_ts - signup_completed_ts)))::double precision AS avg_seconds,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (onboarding_completed_ts - signup_completed_ts))
      )::double precision AS p50_seconds,
      PERCENTILE_CONT(0.9) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (onboarding_completed_ts - signup_completed_ts))
      )::double precision AS p90_seconds,
      MIN(EXTRACT(EPOCH FROM (onboarding_completed_ts - signup_completed_ts)))::double precision AS min_seconds,
      MAX(EXTRACT(EPOCH FROM (onboarding_completed_ts - signup_completed_ts)))::double precision AS max_seconds
    FROM journeys
    WHERE signup_completed_ts IS NOT NULL
      AND onboarding_completed_ts IS NOT NULL
      AND onboarding_completed_ts >= signup_completed_ts
  `;

  const metrics = rows[0];
  return {
    sampleSize: Number(metrics?.sample_size ?? 0),
    avgMinutes: roundMinutes(metrics?.avg_seconds ?? null),
    p50Minutes: roundMinutes(metrics?.p50_seconds ?? null),
    p90Minutes: roundMinutes(metrics?.p90_seconds ?? null),
    minMinutes: roundMinutes(metrics?.min_seconds ?? null),
    maxMinutes: roundMinutes(metrics?.max_seconds ?? null),
  };
}
