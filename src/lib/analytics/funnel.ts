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

const FUNNEL_STAGES = [
  { stage: "homepage", eventName: "homepage_view" },
  { stage: "signup_started", eventName: "signup_started" },
  { stage: "signup_completed", eventName: "signup_completed" },
  { stage: "onboarding_completed", eventName: "onboarding_completed" },
  { stage: "plan_activated", eventName: "plan_activated" },
] as const;

export async function getFunnelStages(
  startDate: Date,
  endDate: Date,
): Promise<FunnelStage[]> {
  const stages: FunnelStage[] = [];

  for (const { stage, eventName } of FUNNEL_STAGES) {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_session_id)) as count
      FROM analytics_events
      WHERE event_name = ${eventName}
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
    `;

    const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE event_name = ${eventName}
        AND event_ts >= ${startDate}
        AND event_ts <= ${endDate}
    `;

    const userResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE event_name = ${eventName}
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
  startDate: Date,
  endDate: Date,
): Promise<FunnelResult> {
  const stages = await getFunnelStages(startDate, endDate);
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

export async function getEventCountsLast24h(): Promise<EventCountByType[]> {
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
    WHERE event_ts >= ${startDate}
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
  limit = 10,
): Promise<FullFunnelPath[]> {
  const results = await prisma.$queryRaw<FullFunnelPath[]>`
    WITH ranked_events AS (
      SELECT
        COALESCE(user_id, anonymous_session_id) as session_key,
        user_id,
        anonymous_session_id,
        workspace_id,
        event_name,
        event_ts,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(user_id, anonymous_session_id)
          ORDER BY event_ts ASC
        ) as rn
      FROM analytics_events
      WHERE event_name IN ('homepage_view', 'signup_started', 'signup_completed', 'onboarding_completed', 'plan_activated')
    ),
    session_stages AS (
      SELECT
        session_key,
        user_id,
        anonymous_session_id,
        workspace_id,
        ARRAY_AGG(event_name ORDER BY rn) as stages,
        MAX(event_ts) as completed_at
      FROM ranked_events
      GROUP BY session_key, user_id, anonymous_session_id, workspace_id
    )
    SELECT
      anonymous_session_id,
      user_id,
      workspace_id,
      stages as "completedStages",
      completed_at as "completedAt"
    FROM session_stages
    WHERE stages @> ARRAY['homepage_view', 'signup_completed', 'onboarding_completed', 'plan_activated']::text[]
    ORDER BY completed_at DESC
    LIMIT ${limit}
  `;

  return results;
}
