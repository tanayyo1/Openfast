import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { validateProjectClosure } from "@/lib/services/preCloseValidator";

const closeProjectSchema = z.object({
  status: z.enum(["ARCHIVED", "PAUSED"]),
  force: z.boolean().default(false),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
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
    select: { id: true, status: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (project.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Project already archived", code: "ALREADY_ARCHIVED" },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = closeProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { status, force } = parsed.data;

  if (!force) {
    const validation = await validateProjectClosure(id);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Cannot close project - validation failed",
          code: "VALIDATION_FAILED",
          checklist: validation.checklist,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 422 },
      );
    }
  }

  const updatedProject = await prisma.project.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    project: updatedProject,
    message: `Project ${status === "ARCHIVED" ? "archived" : "paused"} successfully`,
  });
}
