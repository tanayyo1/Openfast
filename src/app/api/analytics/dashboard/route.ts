import { NextResponse } from "next/server";
import { computeWorkspaceDashboardSnapshot } from "@/lib/analytics/dashboardSnapshot";
import { getLatestWorkspaceDailyRollup } from "@/lib/analytics/rollups";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
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

  const latestRollup = await getLatestWorkspaceDailyRollup(session.workspaceId);
  const rollupAgeMs = latestRollup
    ? Date.now() - latestRollup.ingestedAt.getTime()
    : Number.POSITIVE_INFINITY;
  const useRollup = rollupAgeMs <= 36 * 60 * 60 * 1000;

  if (latestRollup && useRollup) {
    return NextResponse.json({
      source: "rollup",
      generatedAt: latestRollup.payload.generatedAt,
      summary: latestRollup.payload.summary,
      byProject: latestRollup.payload.byProject,
    });
  }

  const snapshot = await computeWorkspaceDashboardSnapshot(session.workspaceId);
  return NextResponse.json({
    source: "live",
    generatedAt: new Date().toISOString(),
    summary: snapshot.summary,
    byProject: snapshot.byProject,
  });
}
