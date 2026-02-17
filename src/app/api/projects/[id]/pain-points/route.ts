import { NextResponse } from "next/server";
import { z } from "zod";
import { CandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateProjectPainPoints } from "@/lib/painPoints/generate";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const postSchema = z.object({
  perSubredditLimit: z.number().int().min(1).max(12).optional(),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

async function verifyProjectAccess(input: {
  workspaceId: string;
  projectId: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      workspaceId: input.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });
  return project;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const projectId = ctx.params.id;
  const project = await verifyProjectAccess({
    workspaceId: session.workspaceId,
    projectId,
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const items = await prisma.projectPainPoint.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: CandidateStatus.ACTIVE,
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [
      { frequency: "desc" },
      { severityScore: "desc" },
      { confidenceScore: "desc" },
    ],
    take: 50,
  });

  return NextResponse.json({
    projectId,
    count: items.length,
    items: items.map((item) => ({
      id: item.id,
      subredditId: item.subredditId,
      subreddit: item.subreddit,
      phrase: item.phrase,
      normalizedPhrase: item.normalizedPhrase,
      severityScore: item.severityScore,
      confidenceScore: item.confidenceScore,
      frequency: item.frequency,
      evidenceCount: item.evidenceCount,
      sampleTitles: item.sampleTitles,
      sourceThreadIds: item.sourceThreadIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const projectId = ctx.params.id;
  const project = await verifyProjectAccess({
    workspaceId: session.workspaceId,
    projectId,
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  let json: unknown = {};
  try {
    const rawBody = await req.text();
    json = rawBody.trim().length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = postSchema.safeParse(json);
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

  let generated;
  try {
    generated = await generateProjectPainPoints({
      workspaceId: session.workspaceId,
      projectId,
      perSubredditLimit: parsed.data.perSubredditLimit,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Project not found", code: "PROJECT_NOT_FOUND" },
        { status: 404 },
      );
    }
    throw err;
  }

  return NextResponse.json({
    projectId,
    extracted: generated.extracted,
    subredditCount: generated.subreddits,
    items: generated.items.map((item) => ({
      id: item.id,
      subredditId: item.subredditId,
      phrase: item.phrase,
      severityScore: item.severityScore,
      confidenceScore: item.confidenceScore,
      frequency: item.frequency,
    })),
  });
}
