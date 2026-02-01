import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const updateDraftSchema = z.object({
  title: z.string().min(1).max(300).optional().nullable(),
  body: z.string().min(1).max(50_000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
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

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;
  const draft = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
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
      generationParams: true,
      status: true,
      riskScore: true,
      riskReasons: true,
      suggestedFixes: true,
      approvedAt: true,
      approvedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ draft });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;
  const existing = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Disallow content edits after approval unless it goes back to DRAFT/REJECTED.
  if (existing.status === "APPROVED") {
    return NextResponse.json(
      { error: "Approved drafts cannot be edited", code: "INVALID_STATE" },
      { status: 409 },
    );
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

  const parsed = updateDraftSchema.safeParse(json);
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

  const updateData: Prisma.DraftUpdateInput = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
    ...(parsed.data.mediaUrls !== undefined
      ? { mediaUrls: parsed.data.mediaUrls }
      : {}),
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

  const updated = await prisma.draft.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      title: true,
      body: true,
      variants: true,
      riskScore: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ draft: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;
  const existing = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await prisma.draft.update({
    where: { id },
    data: { status: "ARCHIVED" },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
