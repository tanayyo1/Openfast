import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { QuotaExceededError, assertWorkspaceQuota } from "@/lib/billing/quota";
import {
  enqueueContentGenerateJob,
  type ContentGenerateMode,
} from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const rewriteSchema = z.object({
  mode: z.enum(["REWRITE", "COMPLIANCE"]).default("REWRITE"),
  variantCount: z.coerce.number().int().min(3).max(5).default(3),
  tone: z.string().trim().min(1).max(80).optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
    json = {};
  }

  const parsed = rewriteSchema.safeParse(json);
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

  const { id } = await ctx.params;
  const sourceDraft = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      taskId: true,
      subredditId: true,
      type: true,
      title: true,
      body: true,
      mediaUrls: true,
      status: true,
      project: { select: { status: true } },
    },
  });
  if (!sourceDraft) {
    return NextResponse.json(
      { error: "Draft not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (sourceDraft.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Archived draft cannot be rewritten", code: "INVALID_STATE" },
      { status: 409 },
    );
  }
  if (sourceDraft.project.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Project is archived", code: "INVALID_STATE" },
      { status: 409 },
    );
  }
  if (!sourceDraft.taskId) {
    return NextResponse.json(
      {
        error: "Draft rewrite requires a task-linked draft",
        code: "TASK_REQUIRED",
      },
      { status: 409 },
    );
  }

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

  const payload = parsed.data;
  const rewritten = await prisma.draft.create({
    data: {
      workspaceId: sourceDraft.workspaceId,
      projectId: sourceDraft.projectId,
      taskId: sourceDraft.taskId,
      subredditId: sourceDraft.subredditId,
      type: sourceDraft.type,
      title: sourceDraft.title,
      body: sourceDraft.body,
      mediaUrls: sourceDraft.mediaUrls ?? [],
      variants: Prisma.DbNull,
      generationParams: {
        queued: true,
        mode: payload.mode,
        variantCount: payload.variantCount,
        tone: payload.tone ?? null,
        length: payload.length,
        sourceDraftId: sourceDraft.id,
      } as Prisma.InputJsonValue,
      status: "DRAFT",
      riskScore: 0,
      riskReasons: [],
      suggestedFixes: Prisma.DbNull,
    },
    select: {
      id: true,
      taskId: true,
      type: true,
      title: true,
      body: true,
      status: true,
      riskScore: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const mode = payload.mode as ContentGenerateMode;
  const job = await enqueueContentGenerateJob({
    workspaceId: sourceDraft.workspaceId,
    taskId: sourceDraft.taskId,
    draftId: rewritten.id,
    mode,
    variantCount: payload.variantCount,
    tone: payload.tone ?? null,
    length: payload.length,
    sourceDraftId: sourceDraft.id,
  });

  return NextResponse.json(
    {
      draft: rewritten,
      queue: { id: job.id, mode },
      sourceDraftId: sourceDraft.id,
      queued: true,
    },
    { status: 202 },
  );
}
