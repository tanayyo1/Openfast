import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

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

  const items = await prisma.projectSubredditRecommendation.findMany({
    where: { workspaceId: session.workspaceId, projectId },
    orderBy: [
      { fitScore: "desc" },
      { riskScore: "asc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      subredditId: true,
      fitScore: true,
      riskScore: true,
      reasons: true,
      status: true,
      selectedAt: true,
      createdAt: true,
      subreddit: {
        select: {
          name: true,
          title: true,
          avgPostsPerDay: true,
          avgCommentsPerPost: true,
          subscribers: true,
          activeUsers: true,
          policy: {
            select: {
              promoAllowed: true,
              linkPolicy: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    projectId,
    count: items.length,
    items: items.map((item) => {
      const reasons =
        item.reasons && typeof item.reasons === "object"
          ? (item.reasons as Record<string, unknown>)
          : null;
      const timeScore =
        reasons && typeof reasons.timeWindowScore === "number"
          ? reasons.timeWindowScore
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
        timeScore,
        totalScore,
        selected: item.status === "SELECTED",
      };
    }),
  });
}
