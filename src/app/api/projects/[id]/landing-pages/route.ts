import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { QuotaExceededError, assertWorkspaceQuota } from "@/lib/billing/quota";
import { generateLandingPage } from "@/lib/landingPages/generate";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  includeArchived: z
    .preprocess((raw) => {
      if (typeof raw !== "string") return raw;
      const value = raw.trim().toLowerCase();
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      return raw;
    }, z.boolean())
    .default(false),
});

const createSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  primaryKeyword: z.string().trim().min(3).max(100),
  audience: z.string().trim().min(2).max(120).optional(),
  tone: z.string().trim().min(2).max(80).optional(),
  offer: z.string().trim().min(4).max(300).optional(),
  ctaText: z.string().trim().min(3).max(100).optional(),
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

async function findProjectOr404(input: { workspaceId: string; projectId: string }) {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      workspaceId: input.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      description: true,
      niche: true,
    },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }
  return project;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const project = await findProjectOr404({
    workspaceId: session.workspaceId,
    projectId: ctx.params.id,
  });
  if (project instanceof NextResponse) return project;

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

  const items = await prisma.landingPageDraft.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId: project.id,
      ...(parsed.data.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: parsed.data.limit,
    select: draftSelect,
  });

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    count: items.length,
    items,
  });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const project = await findProjectOr404({
    workspaceId: session.workspaceId,
    projectId: ctx.params.id,
  });
  if (project instanceof NextResponse) return project;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(json);
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

  const landing = await generateLandingPage({
    projectName: project.name,
    projectDescription: project.description,
    projectNiche: project.niche,
    primaryKeyword: parsed.data.primaryKeyword,
    audience: parsed.data.audience ?? `${project.niche} buyers`,
    tone: parsed.data.tone ?? "clear and practical",
    offer:
      parsed.data.offer ??
      (project.description.trim().slice(0, 200) || "Practical strategy support"),
    ctaText: parsed.data.ctaText ?? "Get started",
  });

  const created = await prisma.landingPageDraft.create({
    data: {
      workspaceId: session.workspaceId,
      projectId: project.id,
      name:
        parsed.data.name ??
        `${project.name} • ${landing.primaryKeyword}`.slice(0, 120),
      primaryKeyword: landing.primaryKeyword,
      slug: landing.slug,
      audience: landing.audience,
      tone: landing.tone,
      ctaText: landing.ctaText,
      headline: landing.headline,
      subheadline: landing.subheadline,
      sections: landing.sections as Prisma.InputJsonValue,
      metaTitle: landing.metaTitle,
      metaDescription: landing.metaDescription,
      source: landing.source,
    },
    select: draftSelect,
  });

  return NextResponse.json({ draft: created }, { status: 201 });
}
