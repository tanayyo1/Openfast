import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
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

type DateRangeResult =
  | { ok: true; startDate: Date; endDate: Date }
  | { ok: false; error: string };

const PERIOD_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

export function resolveDateRange(
  searchParams: URLSearchParams,
  now = new Date(),
): DateRangeResult {
  const period = searchParams.get("period") ?? "7d";
  const startDateStr = searchParams.get("start");
  const endDateStr = searchParams.get("end");

  if ((startDateStr && !endDateStr) || (!startDateStr && endDateStr)) {
    return { ok: false, error: "Both start and end must be provided together" };
  }

  if (startDateStr && endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return { ok: false, error: "Invalid date range" };
    }
    return { ok: true, startDate, endDate };
  }

  const days = PERIOD_DAYS[period];
  if (!days) {
    return { ok: false, error: "period must be one of: 24h, 7d, 30d" };
  }

  return {
    ok: true,
    startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    endDate: now,
  };
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
