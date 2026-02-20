import { NextResponse } from "next/server";
import { getWorkspaceDashboardData } from "@/lib/analytics/dashboardData";
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

  const dashboard = await getWorkspaceDashboardData(session.workspaceId);
  return NextResponse.json({
    source: dashboard.source,
    generatedAt: dashboard.generatedAt,
    summary: dashboard.summary,
    byProject: dashboard.byProject,
  });
}
