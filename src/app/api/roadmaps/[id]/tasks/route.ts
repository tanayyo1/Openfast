import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const roadmapId = ctx.params.id;
  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, workspaceId: session.workspaceId },
    select: { id: true },
  });

  if (!roadmap) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const tasks = await prisma.roadmapTask.findMany({
    where: { roadmapId, workspaceId: session.workspaceId },
    orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
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

  return NextResponse.json({ items: tasks });
}
