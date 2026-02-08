import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const selectRecommendationsSchema = z.object({
  subredditIds: z.array(z.string().min(1)).min(1).max(5),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
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

  const parsed = selectRecommendationsSchema.safeParse(json);
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

  const projectId = ctx.params.id;
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const subredditIds = Array.from(new Set(parsed.data.subredditIds));

  const existing = await prisma.subredditRecommendation.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      subredditId: { in: subredditIds },
    },
    select: { subredditId: true },
  });
  if (existing.length !== subredditIds.length) {
    return NextResponse.json(
      {
        error: "One or more recommendations not found",
        code: "RECOMMENDATION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const updated = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.subredditRecommendation.updateMany({
        where: { workspaceId: session.workspaceId, projectId },
        data: { selected: false, selectedAt: null },
      });
      await tx.subredditRecommendation.updateMany({
        where: {
          workspaceId: session.workspaceId,
          projectId,
          subredditId: { in: subredditIds },
        },
        data: { selected: true, selectedAt: new Date() },
      });
      return tx.subredditRecommendation.findMany({
        where: {
          workspaceId: session.workspaceId,
          projectId,
          selected: true,
        },
        orderBy: [{ totalScore: "desc" }],
        select: {
          id: true,
          subredditId: true,
          totalScore: true,
          selectedAt: true,
        },
      });
    },
  );

  return NextResponse.json({
    projectId,
    selectedCount: updated.length,
    items: updated,
  });
}
