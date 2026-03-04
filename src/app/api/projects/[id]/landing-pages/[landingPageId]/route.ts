import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const patchSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  ctaText: z.string().trim().min(3).max(100).optional(),
  archived: z.boolean().optional(),
});

const draftSelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  name: true,
  primaryKeyword: true,
  slug: true,
  audience: true,
  tone: true,
  ctaText: true,
  headline: true,
  subheadline: true,
  sections: true,
  metaTitle: true,
  metaDescription: true,
  source: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} satisfies Prisma.LandingPageDraftSelect;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

async function findDraftOr404(input: {
  workspaceId: string;
  projectId: string;
  landingPageId: string;
}) {
  const draft = await prisma.landingPageDraft.findFirst({
    where: {
      id: input.landingPageId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    },
    select: draftSelect,
  });
  if (!draft) {
    return NextResponse.json(
      { error: "Landing page draft not found", code: "LANDING_PAGE_NOT_FOUND" },
      { status: 404 },
    );
  }
  return draft;
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string; landingPageId: string } },
) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const draft = await findDraftOr404({
    workspaceId: session.workspaceId,
    projectId: ctx.params.id,
    landingPageId: ctx.params.landingPageId,
  });
  if (draft instanceof NextResponse) return draft;

  return NextResponse.json({ draft });
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string; landingPageId: string } },
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
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(json);
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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update", code: "NO_UPDATES" },
      { status: 400 },
    );
  }

  const current = await findDraftOr404({
    workspaceId: session.workspaceId,
    projectId: ctx.params.id,
    landingPageId: ctx.params.landingPageId,
  });
  if (current instanceof NextResponse) return current;

  const updated = await prisma.landingPageDraft.update({
    where: { id: current.id },
    data: {
      name: parsed.data.name ?? current.name,
      ctaText: parsed.data.ctaText ?? current.ctaText,
      archivedAt:
        parsed.data.archived === undefined
          ? current.archivedAt
          : parsed.data.archived
            ? (current.archivedAt ?? new Date())
            : null,
    },
    select: draftSelect,
  });

  return NextResponse.json({ draft: updated });
}
