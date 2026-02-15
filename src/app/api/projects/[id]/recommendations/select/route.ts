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

  const existing = await prisma.projectSubredditRecommendation.findMany({
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
      await tx.projectSubredditRecommendation.updateMany({
        where: { workspaceId: session.workspaceId, projectId },
        data: { status: "CANDIDATE", selectedAt: null },
      });
      await tx.projectSubredditRecommendation.updateMany({
        where: {
          workspaceId: session.workspaceId,
          projectId,
          subredditId: { in: subredditIds },
        },
        data: { status: "SELECTED", selectedAt: new Date() },
      });
      return tx.projectSubredditRecommendation.findMany({
        where: {
          workspaceId: session.workspaceId,
          projectId,
          status: "SELECTED",
        },
        orderBy: [{ fitScore: "desc" }, { riskScore: "asc" }, { id: "asc" }],
        select: {
          id: true,
          subredditId: true,
          fitScore: true,
          riskScore: true,
          reasons: true,
          selectedAt: true,
        },
      });
    },
  );

  return NextResponse.json({
    projectId,
    selectedCount: updated.length,
    items: updated.map((item) => {
      const reasons =
        item.reasons && typeof item.reasons === "object"
          ? (item.reasons as Record<string, unknown>)
          : null;
      const totalScore =
        reasons && typeof reasons.compositeScore === "number"
          ? reasons.compositeScore
          : Math.max(
              0,
              Math.min(1, item.fitScore * 0.7 + (1 - item.riskScore) * 0.3),
            );

      return {
        ...item,
        totalScore,
      };
    }),
  });
}
