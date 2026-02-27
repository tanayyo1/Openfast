import { NextResponse } from "next/server";
import { computeProjectAnalyticsSnapshot } from "@/lib/analytics/projectSnapshot";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const rawCursor = url.searchParams.get("cursor");
  const rawDays = url.searchParams.get("days");
  const parsedLimit =
    rawLimit == null || rawLimit.trim().length === 0
      ? undefined
      : Number(rawLimit);
  const parsedDays =
    rawDays == null || rawDays.trim().length === 0 ? undefined : Number(rawDays);
  const cursor = rawCursor && rawCursor.trim().length > 0 ? rawCursor : null;

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
    {
      itemLimit: parsedLimit,
      cursor,
      trendDays: parsedDays,
    },
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }
  return NextResponse.json(snapshot);
}
