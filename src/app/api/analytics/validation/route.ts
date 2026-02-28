import { NextResponse } from "next/server";
import { requireWorkspaceAdminSession } from "@/lib/server/admin-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { validateAnalyticsPipeline } from "@/lib/analytics/validation";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status =
    code === "WORKSPACE_REQUIRED" ? 400 : code === "FORBIDDEN" ? 403 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceAdminSession();
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

  const result = await validateAnalyticsPipeline(session.workspaceId);

  return NextResponse.json({
    ...result,
    requestedBy: {
      workspaceId: session.workspaceId,
      userId: session.user.id,
    },
  });
}
