import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  status: z
    .enum(["DRAFT", "REVIEWING", "APPROVED", "REJECTED", "ARCHIVED"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createDraftSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  subredditId: z.string().min(1).optional(),
  type: z.enum(["POST", "COMMENT"]),
  title: z.string().min(1).max(300).optional().nullable(),
  body: z.string().min(1).max(50_000),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  variants: z
    .array(
      z.object({
        title: z.string().min(1).max(300).optional().nullable(),
        body: z.string().min(1).max(50_000),
        score: z.number().optional(),
      }),
    )
    .optional(),
  generationParams: z.unknown().optional(),
});

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const { searchParams } = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    projectId: searchParams.get("projectId") ?? undefined,
    taskId: searchParams.get("taskId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

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

  const { projectId, taskId, status, limit } = parsed.data;

  const drafts = await prisma.draft.findMany({
    where: {
      workspaceId: session.workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      projectId: true,
      taskId: true,
      subredditId: true,
      type: true,
      title: true,
      body: true,
      mediaUrls: true,
      variants: true,
      status: true,
      riskScore: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      approvedBy: true,
    },
  });

  return NextResponse.json({ items: drafts });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
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

  const parsed = createDraftSchema.safeParse(json);
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

  const data = parsed.data;

  const project = await prisma.project.findFirst({
    where: {
      id: data.projectId,
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (data.taskId) {
    const task = await prisma.roadmapTask.findFirst({
      where: { id: data.taskId, workspaceId: session.workspaceId },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json(
        { error: "Task not found", code: "TASK_NOT_FOUND" },
        { status: 404 },
      );
    }
  }

  const created = await prisma.draft.create({
    data: {
      workspaceId: session.workspaceId,
      projectId: data.projectId,
      taskId: data.taskId ?? null,
      subredditId: data.subredditId ?? null,
      type: data.type,
      title: data.title ?? null,
      body: data.body,
      mediaUrls: data.mediaUrls,
      variants: data.variants ?? null,
      generationParams: data.generationParams ?? null,
      status: "DRAFT",
      riskScore: 0,
      riskReasons: [],
      suggestedFixes: null,
    },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      type: true,
      title: true,
      body: true,
      variants: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ draft: created }, { status: 201 });
}
