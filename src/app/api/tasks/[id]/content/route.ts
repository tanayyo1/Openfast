import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const listQuerySchema = z.object({
  status: z
    .enum(["DRAFT", "REVIEWING", "APPROVED", "REJECTED", "ARCHIVED"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const patchContentSchema = z.object({
  draftId: z.string().min(1),
  title: z.string().min(1).max(300).optional().nullable(),
  body: z.string().min(1).max(50_000).optional(),
  variants: z
    .array(
      z.object({
        title: z.string().min(1).max(300).optional().nullable(),
        body: z.string().min(1).max(50_000),
        score: z.number().optional(),
      }),
    )
    .optional()
    .nullable(),
  riskScore: z.number().int().min(0).max(100).optional(),
  riskReasons: z.array(z.string()).optional(),
  suggestedFixes: z.unknown().optional().nullable(),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const taskId = ctx.params.id;
  const task = await prisma.roadmapTask.findFirst({
    where: { id: taskId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json(
      { error: "Task not found", code: "TASK_NOT_FOUND" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
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

  const { status, limit } = parsed.data;
  const items = await prisma.draft.findMany({
    where: {
      workspaceId: session.workspaceId,
      taskId,
      ...(status ? { status } : { status: { not: "ARCHIVED" } }),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      taskId: true,
      projectId: true,
      subredditId: true,
      type: true,
      title: true,
      body: true,
      variants: true,
      status: true,
      riskScore: true,
      riskReasons: true,
      suggestedFixes: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      approvedBy: true,
    },
  });

  return NextResponse.json({ items });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
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

  const parsed = patchContentSchema.safeParse(json);
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
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json(
      { error: "Task not found", code: "TASK_NOT_FOUND" },
      { status: 404 },
    );
  }

  const existing = await prisma.draft.findFirst({
    where: {
      id: parsed.data.draftId,
      taskId,
      workspaceId: session.workspaceId,
    },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Draft not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (existing.status === "APPROVED" || existing.status === "ARCHIVED") {
    return NextResponse.json(
      {
        error: "Draft cannot be edited in current state",
        code: "INVALID_STATE",
      },
      { status: 409 },
    );
  }

  const updateData: Prisma.DraftUpdateInput = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
    ...(parsed.data.variants !== undefined
      ? { variants: parsed.data.variants ?? Prisma.DbNull }
      : {}),
    ...(parsed.data.riskScore !== undefined
      ? { riskScore: parsed.data.riskScore }
      : {}),
    ...(parsed.data.riskReasons !== undefined
      ? { riskReasons: parsed.data.riskReasons }
      : {}),
    ...(parsed.data.suggestedFixes !== undefined
      ? { suggestedFixes: parsed.data.suggestedFixes ?? Prisma.DbNull }
      : {}),
  };

  const draft = await prisma.draft.update({
    where: { id: existing.id },
    data: updateData,
    select: {
      id: true,
      taskId: true,
      type: true,
      title: true,
      body: true,
      variants: true,
      status: true,
      riskScore: true,
      riskReasons: true,
      suggestedFixes: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ draft });
}
