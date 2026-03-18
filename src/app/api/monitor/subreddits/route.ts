/**
 * GET  /api/monitor/subreddits — list monitored subreddits for current workspace
 * POST /api/monitor/subreddits — add a subreddit to monitor
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const addSchema = z.object({
  subreddit: z
    .string()
    .trim()
    .min(2)
    .max(21)
    .regex(/^(r\/)?[A-Za-z0-9_]+$/, "Invalid subreddit name")
    .transform((v) => v.toLowerCase().replace(/^r\//, "")),
  projectId: z.string().min(1),
});

export async function GET() {
  const ctx = await requireWorkspaceSession();

  const subs = await prisma.monitoredSubreddit.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      project: { select: { name: true } },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: subs.map((s) => ({
      id: s.id,
      subreddit: s.subreddit,
      projectId: s.projectId,
      projectName: s.project.name,
      isActive: s.isActive,
      postCount: s._count.posts,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await requireWorkspaceSession();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = addSchema.safeParse(json);
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

  // Verify project belongs to this workspace
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  // Check if already monitoring this subreddit for this project
  const existing = await prisma.monitoredSubreddit.findUnique({
    where: {
      projectId_subreddit: {
        projectId: parsed.data.projectId,
        subreddit: parsed.data.subreddit,
      },
    },
  });

  if (existing) {
    // Reactivate if it was deactivated
    if (!existing.isActive) {
      await prisma.monitoredSubreddit.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return NextResponse.json({
      id: existing.id,
      reactivated: !existing.isActive,
    });
  }

  // Limit: max 20 monitored subreddits per workspace
  const count = await prisma.monitoredSubreddit.count({
    where: { workspaceId: ctx.workspaceId, isActive: true },
  });
  if (count >= 20) {
    return NextResponse.json(
      {
        error: "Maximum 20 monitored subreddits per workspace",
        code: "LIMIT_REACHED",
      },
      { status: 400 },
    );
  }

  const created = await prisma.monitoredSubreddit.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: parsed.data.projectId,
      subreddit: parsed.data.subreddit,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
