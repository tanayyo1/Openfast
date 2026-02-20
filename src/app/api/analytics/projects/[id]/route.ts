import { NextResponse } from "next/server";
import { computeProjectAnalyticsSnapshot } from "@/lib/analytics/projectSnapshot";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
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

  const projectId = ctx.params.id;
  const snapshot = await computeProjectAnalyticsSnapshot(
    session.workspaceId,
    projectId,
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }
  return NextResponse.json(snapshot);
}
