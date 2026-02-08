import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  enqueueContentGenerateJob,
  type ContentGenerateMode,
} from "@/lib/queue/enqueue";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const generateContentSchema = z.object({
  mode: z.enum(["GENERATE", "REWRITE", "COMPLIANCE"]).default("GENERATE"),
  type: z.enum(["POST", "COMMENT"]).optional(),
  subredditId: z.string().min(1).optional(),
  sourceDraftId: z.string().min(1).optional(),
  variantCount: z.coerce.number().int().min(3).max(5).default(3),
  tone: z.string().min(1).max(80).optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
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
    json = {};
  }

  const parsed = generateContentSchema.safeParse(json);
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

  const taskId = ctx.params.id;
  const task = await prisma.roadmapTask.findFirst({
    where: { id: taskId, workspaceId: session.workspaceId },
    include: {
      roadmap: {
        include: {
          project: { select: { id: true, status: true } },
        },
      },
    },
  });
  if (!task) {
    return NextResponse.json(
      { error: "Task not found", code: "TASK_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (task.roadmap.project.status === "ARCHIVED") {
    return NextResponse.json(
      {
        error: "Cannot generate content for archived project",
        code: "INVALID_STATE",
      },
      { status: 409 },
    );
  }

  const payload = parsed.data;
  let sourceDraft: {
    id: string;
    type: "POST" | "COMMENT";
    title: string | null;
    body: string;
    status: string;
    subredditId: string | null;
  } | null = null;

  if (payload.sourceDraftId) {
    sourceDraft = await prisma.draft.findFirst({
      where: {
        id: payload.sourceDraftId,
        workspaceId: session.workspaceId,
        taskId,
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        status: true,
        subredditId: true,
      },
    });
    if (!sourceDraft) {
      return NextResponse.json(
        { error: "Source draft not found", code: "SOURCE_DRAFT_NOT_FOUND" },
        { status: 404 },
      );
    }
    if (sourceDraft.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Archived draft cannot be rewritten", code: "INVALID_STATE" },
        { status: 409 },
      );
    }
  }

  const subredditId =
    payload.subredditId ?? sourceDraft?.subredditId ?? task.subredditId;
  const draftType = payload.type ?? sourceDraft?.type ?? "POST";
  const initialTitle = sourceDraft?.title ?? task.title ?? null;
  const initialBody =
    sourceDraft?.body ??
    `${task.instructions}\n\nShare practical details, avoid hype, and ask for feedback.`;

  const draft = await prisma.draft.create({
    data: {
      workspaceId: session.workspaceId,
      projectId: task.roadmap.project.id,
      taskId: task.id,
      subredditId: subredditId ?? null,
      type: draftType,
      title: initialTitle,
      body: initialBody,
      mediaUrls: [],
      variants: Prisma.DbNull,
      generationParams: {
        queued: true,
        mode: payload.mode,
        variantCount: payload.variantCount,
        tone: payload.tone ?? null,
        length: payload.length,
        sourceDraftId: payload.sourceDraftId ?? null,
      },
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
    workspaceId: session.workspaceId,
    taskId: task.id,
    draftId: draft.id,
    mode,
    variantCount: payload.variantCount,
    tone: payload.tone ?? null,
    length: payload.length,
    sourceDraftId: payload.sourceDraftId ?? null,
  });

  return NextResponse.json(
    { draft, queue: { id: job.id, mode }, queued: true },
    { status: 202 },
  );
}
