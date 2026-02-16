import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const updateTaskSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "BLOCKED"]),
});

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
  const task = await prisma.roadmapTask.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      roadmapId: true,
      dayIndex: true,
      type: true,
      subredditId: true,
      fitScore: true,
      title: true,
      instructions: true,
      estimatedTime: true,
      priority: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ task });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = updateTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const id = ctx.params.id;
  const existing = await prisma.roadmapTask.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const nextStatus = parsed.data.status;
  const updated = await prisma.roadmapTask.update({
    where: { id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null,
    },
    select: {
      id: true,
      roadmapId: true,
      dayIndex: true,
      type: true,
      status: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ task: updated });
}
