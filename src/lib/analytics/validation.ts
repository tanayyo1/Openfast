import { prisma } from "@/lib/prisma";

export type ValidationCheck = {
  id: string;
  description: string;
  passed: boolean;
  value: number | string | boolean | null;
  threshold?: number;
  details?: string;
};

export type ValidationResult = {
  passed: boolean;
  checks: ValidationCheck[];
  checkedAt: Date;
  summary: string;
};

export async function validateAnalyticsPipeline(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];

  const homepageCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_name = 'homepage_view'
  `;
  const homepageViews = Number(homepageCount[0]?.count ?? 0);
  checks.push({
    id: "homepage_events_min",
    description: "At least 10 unique homepage_view events in table",
    passed: homepageViews >= 10,
    value: homepageViews,
    threshold: 10,
  });

  const fullPaths = await prisma.$queryRaw<{ count: bigint }[]>`
    WITH session_stages AS (
      SELECT
        COALESCE(user_id, anonymous_session_id) as session_key,
        ARRAY_AGG(DISTINCT event_name) as stages
      FROM analytics_events
      WHERE event_name IN ('homepage_view', 'signup_completed', 'onboarding_completed', 'plan_activated')
      GROUP BY COALESCE(user_id, anonymous_session_id)
    )
    SELECT COUNT(*) as count
    FROM session_stages
    WHERE stages @> ARRAY['homepage_view', 'signup_completed', 'onboarding_completed', 'plan_activated']::text[]
  `;
  const completeFunnels = Number(fullPaths[0]?.count ?? 0);
  checks.push({
    id: "full_funnel_path",
    description:
      "At least 1 full funnel path (homepage → signup → onboarding → plan)",
    passed: completeFunnels >= 1,
    value: completeFunnels,
    threshold: 1,
  });

  const malformedEvents = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_ts IS NULL
       OR (user_id IS NULL AND anonymous_session_id IS NULL)
  `;
  const malformed = Number(malformedEvents[0]?.count ?? 0);
  checks.push({
    id: "no_malformed_events",
    description:
      "No malformed events (null timestamps, missing userId/sessionId)",
    passed: malformed === 0,
    value: malformed,
    threshold: 0,
    details: malformed > 0 ? `Found ${malformed} malformed events` : undefined,
  });

  const queryStart = Date.now();
  await prisma.$queryRaw`
    SELECT event_name, COUNT(*) as count
    FROM analytics_events
    GROUP BY event_name
    ORDER BY count DESC
    LIMIT 10
  `;
  const queryTimeMs = Date.now() - queryStart;
  checks.push({
    id: "dashboard_query_performance",
    description: "Dashboard queries respond in <2s (performance ok)",
    passed: queryTimeMs < 2000,
    value: `${queryTimeMs}ms`,
    threshold: 2000,
    details: `Query completed in ${queryTimeMs}ms`,
  });

  const eventTypes = await prisma.$queryRaw<
    { event_name: string; count: bigint }[]
  >`
    SELECT event_name, COUNT(*) as count
    FROM analytics_events
    GROUP BY event_name
    ORDER BY event_name
  `;
  checks.push({
    id: "event_type_distribution",
    description: "Event type distribution sanity check",
    passed: eventTypes.length > 0,
    value: eventTypes
      .map((e) => `${e.event_name}: ${Number(e.count)}`)
      .join(", "),
    details: `${eventTypes.length} distinct event types`,
  });

  const recentEvents = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_ts > NOW() - INTERVAL '24 hours'
  `;
  const last24h = Number(recentEvents[0]?.count ?? 0);
  checks.push({
    id: "recent_event_ingestion",
    description: "Events are being ingested (events in last 24h)",
    passed: last24h > 0,
    value: last24h,
    threshold: 1,
  });

  const allPassed = checks.every((c) => c.passed);
  const passedCount = checks.filter((c) => c.passed).length;

  return {
    passed: allPassed,
    checks,
    checkedAt: new Date(),
    summary: `${passedCount}/${checks.length} checks passed. ${
      allPassed
        ? "Pipeline validation successful - ready for RED-74/75 closure."
        : "Some checks failed - review before closing RED-74/75."
    }`,
  };
}
