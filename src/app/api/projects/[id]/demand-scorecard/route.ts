import { CandidateStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDemandScorecard } from "@/lib/recommendations/demandScorecard";
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
    where: {
      id: projectId,
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
    },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const [selectedRecommendations, painPoints] = await Promise.all([
    prisma.projectSubredditRecommendation.findMany({
      where: {
        workspaceId: session.workspaceId,
        projectId,
        status: "SELECTED",
      },
      orderBy: { compositeScore: "desc" },
      select: {
        fitScore: true,
        riskScore: true,
        timeWindowScore: true,
        status: true,
        subreddit: {
          select: {
            subscribers: true,
            activeUsers: true,
            avgCommentsPerPost: true,
          },
        },
      },
    }),
    prisma.projectPainPoint.findMany({
      where: {
        workspaceId: session.workspaceId,
        projectId,
        status: CandidateStatus.ACTIVE,
      },
      orderBy: [{ severityScore: "desc" }, { frequency: "desc" }],
      take: 80,
      select: {
        severityScore: true,
        confidenceScore: true,
        frequency: true,
      },
    }),
  ]);

  const candidateRecommendations =
    selectedRecommendations.length > 0
      ? []
      : await prisma.projectSubredditRecommendation.findMany({
          where: {
            workspaceId: session.workspaceId,
            projectId,
            status: "CANDIDATE",
          },
          orderBy: { compositeScore: "desc" },
          take: 30,
          select: {
            fitScore: true,
            riskScore: true,
            timeWindowScore: true,
            status: true,
            subreddit: {
              select: {
                subscribers: true,
                activeUsers: true,
                avgCommentsPerPost: true,
              },
            },
          },
        });

  const recommendations = [
    ...selectedRecommendations,
    ...candidateRecommendations,
  ];

  const scorecard = buildDemandScorecard({
    recommendations,
    painPoints,
  });

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
    scorecard,
    generatedAt: new Date().toISOString(),
  });
}
