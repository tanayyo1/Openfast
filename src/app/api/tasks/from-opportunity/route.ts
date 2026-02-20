import { Prisma, RecommendationStatus, TaskType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  QuotaExceededError,
  assertWorkspaceQuota,
  getWorkspaceEntitlements,
} from "@/lib/billing/quota";
import { enqueueContentGenerateJob } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const createFromOpportunitySchema = z.object({
  projectId: z.string().min(1),
  opportunityId: z.string().min(1),
  roadmapId: z.string().min(1).optional(),
  variantCount: z.coerce.number().int().min(3).max(5).default(3),
  tone: z.string().trim().min(1).max(80).optional(),
  length: z.enum(["short", "medium", "long"]).default("short"),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function taskTitleFromThread(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (normalized.length <= 110) return `Comment on: ${normalized}`;
  return `Comment on: ${normalized.slice(0, 107)}...`;
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (!entitlements.hasSmartFinder) {
    return NextResponse.json(
      {
        error: "Smart Finder is available on paid plans",
        code: "SMART_FINDER_REQUIRED",
      },
      { status: 403 },
    );
  }

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = createFromOpportunitySchema.safeParse(json);
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

  const payload = parsed.data;
  try {
    await assertWorkspaceQuota({
      workspaceId: session.workspaceId,
      resource: "ai_generations",
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: { resource: err.resource, used: err.used, limit: err.limit },
        },
        { status: 403 },
      );
    }
    throw err;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: payload.projectId,
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
      projectId: project.id,
      status: { in: [RecommendationStatus.SELECTED, RecommendationStatus.CANDIDATE] },
    },
    select: {
      subredditId: true,
      fitScore: true,
      compositeScore: true,
      subreddit: { select: { name: true, title: true } },
    },
    orderBy: [{ status: "asc" }, { compositeScore: "desc" }],
    take: 20,
  });
  if (recommendations.length === 0) {
    return NextResponse.json(
      {
        error: "No recommended subreddits available for this project",
        code: "RECOMMENDATIONS_REQUIRED",
      },
      { status: 409 },
    );
  }

  const recommendationBySubreddit = new Map(
    recommendations.map((item) => [item.subredditId, item]),
  );
  const opportunity = await prisma.threadCandidate.findFirst({
    where: {
      id: payload.opportunityId,
      subredditId: { in: recommendations.map((item) => item.subredditId) },
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
  });
  if (!opportunity) {
    return NextResponse.json(
      { error: "Opportunity not found", code: "OPPORTUNITY_NOT_FOUND" },
      { status: 404 },
    );
  }

  const roadmap = payload.roadmapId
    ? await prisma.roadmap.findFirst({
        where: {
          id: payload.roadmapId,
          workspaceId: session.workspaceId,
          projectId: project.id,
          status: "ACTIVE",
        },
        select: { id: true },
      })
    : await prisma.roadmap.findFirst({
        where: {
          workspaceId: session.workspaceId,
          projectId: project.id,
          status: "ACTIVE",
        },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }],
      });
  if (!roadmap) {
    return NextResponse.json(
      {
        error: "No active roadmap found for this project",
        code: "ACTIVE_ROADMAP_REQUIRED",
      },
      { status: 409 },
    );
  }

  const latestTask = await prisma.roadmapTask.findFirst({
    where: {
      workspaceId: session.workspaceId,
      roadmapId: roadmap.id,
    },
    select: { dayIndex: true },
    orderBy: [{ dayIndex: "desc" }],
  });
  const recommendation = recommendationBySubreddit.get(opportunity.subredditId);
  const dayIndex = (latestTask?.dayIndex ?? 0) + 1;
  let created:
    | {
        task: {
          id: string;
          roadmapId: string;
          dayIndex: number;
          type: TaskType;
          subredditId: string | null;
          fitScore: number | null;
          title: string | null;
          instructions: string;
          status: string;
          createdAt: Date;
        };
        draft: {
          id: string;
          taskId: string | null;
          projectId: string;
          subredditId: string | null;
          type: "POST" | "COMMENT";
          title: string | null;
          body: string;
          status: string;
          createdAt: Date;
          updatedAt: Date;
        };
      }
    | null = null;

  try {
    created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claim = await tx.threadCandidate.updateMany({
        where: {
          id: opportunity.id,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
        data: { status: "USED" },
      });
      if (claim.count === 0) {
        throw new Error("OPPORTUNITY_NOT_AVAILABLE");
      }

      const createdTask = await tx.roadmapTask.create({
        data: {
          workspaceId: session.workspaceId,
          roadmapId: roadmap.id,
          dayIndex,
          type: TaskType.COMMENT,
          subredditId: opportunity.subredditId,
          fitScore: recommendation?.fitScore ?? null,
          title: taskTitleFromThread(opportunity.title),
          instructions:
            `Reply with a value-first comment on this thread:\n` +
            `${opportunity.permalink}\n\n` +
            `Focus on actionable help tied to ${project.name}. Avoid promotional language and direct pitches.`,
          priority: 3,
          status: "PENDING",
        },
        select: {
          id: true,
          roadmapId: true,
          dayIndex: true,
          type: true,
          subredditId: true,
          fitScore: true,
          title: true,
          instructions: true,
          status: true,
          createdAt: true,
        },
      });

      const createdDraft = await tx.draft.create({
        data: {
          workspaceId: session.workspaceId,
          projectId: project.id,
          taskId: createdTask.id,
          subredditId: opportunity.subredditId,
          type: "COMMENT",
          title: null,
          body:
            `Thread context: ${opportunity.title}\n` +
            `Permalink: ${opportunity.permalink}\n\n` +
            `Draft a concise, practical comment that helps the OP and fits subreddit norms.`,
          mediaUrls: [],
          variants: Prisma.DbNull,
          generationParams: {
            queued: true,
            source: "opportunity_automation",
            opportunityId: opportunity.id,
            opportunityScore: opportunity.score,
            threadTitle: opportunity.title,
            threadPermalink: opportunity.permalink,
          },
          status: "DRAFT",
          riskScore: 0,
          riskReasons: [],
          suggestedFixes: Prisma.DbNull,
        },
        select: {
          id: true,
          taskId: true,
          projectId: true,
          subredditId: true,
          type: true,
          title: true,
          body: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { task: createdTask, draft: createdDraft };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "OPPORTUNITY_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          error: "Opportunity is no longer available",
          code: "OPPORTUNITY_NOT_AVAILABLE",
        },
        { status: 409 },
      );
    }
    throw err;
  }
  if (!created) {
    throw new Error("OPPORTUNITY_TRANSACTION_FAILED");
  }

  try {
    const job = await enqueueContentGenerateJob({
      workspaceId: session.workspaceId,
      taskId: created.task.id,
      draftId: created.draft.id,
      mode: "GENERATE",
      variantCount: payload.variantCount,
      tone: payload.tone ?? "helpful",
      length: payload.length,
      sourceDraftId: null,
    });

    return NextResponse.json(
      {
        projectId: project.id,
        opportunityId: opportunity.id,
        task: created.task,
        draft: created.draft,
        queued: true,
        queue: {
          id: job.id,
          mode: "GENERATE",
        },
      },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      {
        projectId: project.id,
        opportunityId: opportunity.id,
        task: created.task,
        draft: created.draft,
        queued: false,
        warning:
          "Comment draft scaffold created but content generation queue is unavailable.",
      },
      { status: 201 },
    );
  }
}
