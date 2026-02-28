import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import {
  validateProjectClosure,
  getProjectCompletionStats,
  type PreCloseValidationResult,
} from "@/lib/services/preCloseValidator";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;

  const project = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const [validation, stats] = await Promise.all([
    validateProjectClosure(id),
    getProjectCompletionStats(id),
  ]);

  return NextResponse.json({
    projectId: id,
    valid: validation.valid,
    checklist: validation.checklist,
    warnings: validation.warnings,
    errors: validation.errors,
    stats,
  });
}
