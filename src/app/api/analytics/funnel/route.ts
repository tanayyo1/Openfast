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

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "7d";
  const startDateStr = searchParams.get("start");
  const endDateStr = searchParams.get("end");

  let startDate: Date;
  let endDate = new Date();

  if (startDateStr && endDateStr) {
    startDate = new Date(startDateStr);
    endDate = new Date(endDateStr);
  } else {
    const days = period === "24h" ? 1 : period === "30d" ? 30 : 7;
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  const [funnelData, eventCounts, fullPaths] = await Promise.all([
    getFunnelData(startDate, endDate),
    getEventCountsLast24h(),
    getFullFunnelPaths(5),
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
