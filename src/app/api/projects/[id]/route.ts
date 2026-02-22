import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(10_000).optional(),
  url: z.string().url().optional().nullable(),
  niche: z.string().min(1).max(120).optional(),
  goals: z.unknown().optional(),
  brandVoice: z.unknown().optional(),
  constraints: z.unknown().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
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
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      niche: true,
      goals: true,
      brandVoice: true,
      constraints: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ project });
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = updateProjectSchema.safeParse(json);
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

  const id = ctx.params.id;
  if (parsed.data.goals === null || parsed.data.brandVoice === null) {
    return NextResponse.json(
      { error: "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const updateData: Prisma.ProjectUpdateInput = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description }
      : {}),
    ...(parsed.data.url !== undefined ? { url: parsed.data.url ?? null } : {}),
    ...(parsed.data.niche !== undefined ? { niche: parsed.data.niche } : {}),
    ...(parsed.data.goals !== undefined
      ? { goals: parsed.data.goals as Prisma.InputJsonValue }
      : {}),
    ...(parsed.data.brandVoice !== undefined
      ? { brandVoice: parsed.data.brandVoice as Prisma.InputJsonValue }
      : {}),
    ...(parsed.data.constraints !== undefined
      ? { constraints: parsed.data.constraints ?? Prisma.DbNull }
      : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
  };

  const updateResult = await prisma.project.updateMany({
    where: { id, workspaceId: session.workspaceId },
    data: updateData,
  });
  if (updateResult.count === 0) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  const updated = await prisma.project.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      niche: true,
      goals: true,
      brandVoice: true,
      constraints: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ project: updated });
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
  const archived = await prisma.project.updateMany({
    where: { id, workspaceId: session.workspaceId },
    data: { status: "ARCHIVED" },
  });
  if (archived.count === 0) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
