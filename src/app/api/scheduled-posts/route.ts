import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { enqueuePublishJob } from "@/lib/queue/enqueue";
import { getRedis } from "@/lib/redis";
import { Prisma } from "@prisma/client";

const scheduleSchema = z.object({
  draftId: z.string().min(1),
  redditAccountId: z.string().min(1),
  subredditId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1).optional(),
});

function buildIdempotencyKey(
  draftId: string,
  redditAccountId: string,
  subredditId: string,
  scheduledAtIso: string,
) {
  // Deterministic key to prevent double-scheduling in UI retries.
  return `schedule:${draftId}:${redditAccountId}:${subredditId}:${scheduledAtIso}`;
}

export async function POST(req: Request) {
  const session = await requireWorkspaceSession();

  const parsed = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Require Redis because scheduling must enqueue a publish job.
  if (!getRedis()) {
    return NextResponse.json(
      { error: "Redis is not configured" },
      { status: 503 },
    );
  }

  const { draftId, redditAccountId, subredditId, scheduledAt, timezone } =
    parsed.data;

  const draft = await prisma.draft.findFirst({
    where: {
      id: draftId,
      workspaceId: session.workspaceId,
    },
    select: {
      id: true,
      projectId: true,
      status: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  if (draft.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Draft must be approved before scheduling" },
      { status: 400 },
    );
  }

  // Ensure reddit account belongs to the workspace.
  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId: session.workspaceId },
    select: { id: true },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Reddit account not found" },
      { status: 404 },
    );
  }

  const subreddit = await prisma.subredditCatalog.findFirst({
    where: { id: subredditId },
    select: { id: true },
  });

  if (!subreddit) {
    return NextResponse.json({ error: "Subreddit not found" }, { status: 404 });
  }

  const scheduledAtDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledAtDate.getTime())) {
    return NextResponse.json(
      { error: "scheduledAt must be a valid datetime" },
      { status: 400 },
    );
  }

  const idempotencyKey =
    req.headers.get("idempotency-key")?.trim() ||
    buildIdempotencyKey(draftId, redditAccountId, subredditId, scheduledAt);

  try {
    const scheduled = await prisma.scheduledPost.create({
      data: {
        workspaceId: session.workspaceId,
        redditAccountId,
        subredditId,
        draftId,
        scheduledAt: scheduledAtDate,
        timezone: timezone ?? "UTC",
        idempotencyKey,
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
    });

    await enqueuePublishJob(
      { scheduledPostId: scheduled.id },
      {
        delay: Math.max(0, scheduledAtDate.getTime() - Date.now()),
      },
    );

    return NextResponse.json({ scheduledPost: scheduled }, { status: 201 });
  } catch (error) {
    // Idempotency: if we already created this schedule, return it.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.scheduledPost.findFirst({
        where: {
          workspaceId: session.workspaceId,
          OR: [{ draftId }, { idempotencyKey }],
        },
        select: { id: true, scheduledAt: true, status: true },
      });

      if (existing) {
        return NextResponse.json({ scheduledPost: existing }, { status: 200 });
      }
    }

    return NextResponse.json({ error: "Failed to schedule" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await requireWorkspaceSession();

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query param is required" },
      { status: 400 },
    );
  }

  // Verify project belongs to workspace.
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      workspaceId: session.workspaceId,
      draft: { projectId },
    },
    orderBy: { scheduledAt: "desc" },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      timezone: true,
      attempts: true,
      lastError: true,
      publishedAt: true,
      publishedItemId: true,
      subreddit: { select: { name: true } },
      redditAccount: { select: { redditUsername: true } },
      draft: { select: { id: true, title: true, status: true } },
    },
    take: 200,
  });

  return NextResponse.json({ scheduledPosts }, { status: 200 });
}
