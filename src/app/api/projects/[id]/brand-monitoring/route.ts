import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { buildProjectBrandMonitoringSnapshot } from "@/lib/brandMonitoring/monitor";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  lookbackDays: z.coerce.number().int().min(1).max(60).default(14),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (!entitlements.hasSmartFinder) {
    return NextResponse.json(
      {
        error: "Smart Finder is available on paid plans",
        code: "SMART_FINDER_REQUIRED",
      },
      { status: 403 },
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const snapshot = await buildProjectBrandMonitoringSnapshot({
    workspaceId: session.workspaceId,
    projectId: ctx.params.id,
    lookbackDays: parsed.data.lookbackDays,
    limit: parsed.data.limit,
  });
  if (!snapshot) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...snapshot,
    generatedAt: new Date().toISOString(),
  });
}
