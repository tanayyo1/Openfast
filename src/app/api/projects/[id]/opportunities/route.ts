import { CandidateStatus, RecommendationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  minScore: z.coerce.number().min(0).max(1).default(0),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function velocityLabel(score: number) {
  if (score >= 0.67) return "Fast";
  if (score >= 0.34) return "Medium";
  return "Slow";
}

function riskLabel(score: number) {
  if (score >= 0.67) return "High";
  if (score >= 0.34) return "Medium";
  return "Low";
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
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

  const projectId = ctx.params.id;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true, name: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const recommendations = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: { in: [RecommendationStatus.SELECTED, RecommendationStatus.CANDIDATE] },
    },
    select: {
      subredditId: true,
      status: true,
      fitScore: true,
      compositeScore: true,
    },
    orderBy: [{ status: "asc" }, { compositeScore: "desc" }],
    take: 12,
  });
  if (recommendations.length === 0) {
    return NextResponse.json({
      projectId,
      projectName: project.name,
      count: 0,
      items: [],
    });
  }

  const recommendationBySubreddit = new Map(
    recommendations.map((item) => [item.subredditId, item]),
  );
  const opportunities = await prisma.threadCandidate.findMany({
    where: {
      subredditId: { in: recommendations.map((item) => item.subredditId) },
      status: CandidateStatus.ACTIVE,
      expiresAt: { gt: new Date() },
      score: { gte: parsed.data.minScore },
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: parsed.data.limit,
  });

  return NextResponse.json({
    projectId,
    projectName: project.name,
    count: opportunities.length,
    items: opportunities.map((item) => {
      const recommendation = recommendationBySubreddit.get(item.subredditId) ?? null;
      return {
        id: item.id,
        subredditId: item.subredditId,
        subredditName: item.subreddit.name,
        subredditTitle: item.subreddit.title,
        title: item.title,
        permalink: item.permalink,
        author: item.author,
        opportunityScore: item.score,
        relevanceScore: item.relevanceScore,
        velocityScore: item.velocityScore,
        riskScore: item.riskScore,
        velocity: velocityLabel(item.velocityScore),
        risk: riskLabel(item.riskScore),
        reasons: item.reasons,
        status: item.status,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        recommendation: recommendation
          ? {
              status: recommendation.status,
              fitScore: recommendation.fitScore,
              compositeScore: recommendation.compositeScore,
            }
          : null,
      };
    }),
  });
}
