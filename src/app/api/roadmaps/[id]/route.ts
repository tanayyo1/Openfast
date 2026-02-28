import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { retargetRoadmapTasks } from "@/lib/roadmapRetarget";

const updateRoadmapSchema = z.object({
  startDate: z.string().datetime().optional(),
  horizonDays: z.number().int().min(1).max(60).optional(),
  retargetCompletedTasks: z.boolean().optional().default(false),
  retargetLockedTasks: z.boolean().optional().default(false),
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
  const roadmap = await prisma.roadmap.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      strategy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!roadmap) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ roadmap });
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

  const id = ctx.params.id;

  const existing = await prisma.roadmap.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, startDate: true, horizonDays: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const body = await req.json();
  const parseResult = updateRoadmapSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const {
    startDate,
    horizonDays,
    retargetCompletedTasks,
    retargetLockedTasks,
  } = parseResult.data;

  if (!startDate && !horizonDays) {
    return NextResponse.json({
      roadmap: existing,
      message: "No changes requested",
    });
  }

  const newStartDate = startDate ? new Date(startDate) : existing.startDate;
  const newHorizonDays = horizonDays ?? existing.horizonDays;

  const retargetResult = await retargetRoadmapTasks(
    id,
    session.workspaceId,
    newStartDate,
    {
      retargetCompletedTasks: retargetCompletedTasks ?? false,
      retargetLockedTasks: retargetLockedTasks ?? false,
    },
  );

  if (!retargetResult.success) {
    return NextResponse.json(
      {
        error: retargetResult.errors[0] ?? "Failed to update roadmap",
        code: "UPDATE_FAILED",
      },
      { status: 500 },
    );
  }

  const updated = await prisma.roadmap.findFirst({
    where: { id },
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      strategy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    roadmap: updated,
    retarget: {
      deltaDays: retargetResult.deltaDays,
      tasksUpdated: retargetResult.tasksUpdated,
    },
  });
}
