import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { resolveDateRange } from "@/lib/analytics/dateRange";
import {
  getFunnelData,
  getEventCountsLast24h,
  getFullFunnelPaths,
} from "@/lib/analytics/funnel";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const { searchParams } = new URL(req.url);
  const dateRange = resolveDateRange(searchParams);
  if (!dateRange.ok) {
    return NextResponse.json(
      { error: "Invalid query params", code: "INVALID_DATE_RANGE" },
      { status: 400 },
    );
  }
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (!entitlements.hasAdvancedAnalytics) {
    return NextResponse.json(
      {
        error: "Advanced analytics is available on paid plans",
        code: "ADVANCED_ANALYTICS_REQUIRED",
      },
      { status: 403 },
    );
  }

  const [funnelData, eventCounts, fullPaths] = await Promise.all([
    getFunnelData(session.workspaceId, dateRange.startDate, dateRange.endDate),
    getEventCountsLast24h(session.workspaceId),
    getFullFunnelPaths(
      session.workspaceId,
      dateRange.startDate,
      dateRange.endDate,
      5,
    ),
  ]);

  return NextResponse.json({
    funnel: funnelData,
    eventCountsLast24h: eventCounts,
    recentCompleteFunnels: fullPaths,
    requestedBy: {
      workspaceId: session.workspaceId,
      userId: session.user.id,
    },
  });
}
