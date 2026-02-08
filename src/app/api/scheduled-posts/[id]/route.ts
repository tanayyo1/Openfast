import { NextResponse } from "next/server";
import { getPublishQueue } from "@/lib/queue/queues";
import { publishJobId } from "@/lib/queue/jobIds";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const CANCELLABLE_STATUSES = new Set([
  "SCHEDULED",
  "PENDING_APPROVAL",
  "FAILED_RETRYABLE",
]);

const DELETABLE_STATUSES = new Set([
  "SCHEDULED",
  "PENDING_APPROVAL",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "CANCELLED",
]);

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

async function removePendingQueueJob(scheduledPostId: string) {
  try {
    const queue = getPublishQueue();
    const deterministic = await queue.getJob(publishJobId(scheduledPostId));
    if (deterministic) await deterministic.remove();
    const prefix = `publish:${scheduledPostId}:`;
    const waiting = await queue.getJobs(["waiting", "delayed"], 0, 1000, true);
    await Promise.all(
      waiting
        .filter((j) => typeof j.id === "string" && j.id.startsWith(prefix))
        .map((j) => j.remove().catch(() => undefined)),
    );
  } catch {
    // Best-effort queue cleanup should not break API behavior.
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const action = (body as { action?: string } | null)?.action;
  if (action !== "cancel") {
    return NextResponse.json(
      {
        error: "Unsupported action",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const id = ctx.params.id;
  const existing = await prisma.scheduledPost.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Scheduled post not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (!CANCELLABLE_STATUSES.has(existing.status)) {
    return NextResponse.json(
      {
        error: `Cannot cancel scheduled post in status ${existing.status}`,
        code: "INVALID_STATE",
      },
      { status: 409 },
    );
  }

  await prisma.scheduledPost.update({
    where: { id },
    data: { status: "CANCELLED", lastError: null },
  });
  await removePendingQueueJob(id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const id = ctx.params.id;
  const existing = await prisma.scheduledPost.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Scheduled post not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  if (!DELETABLE_STATUSES.has(existing.status)) {
    return NextResponse.json(
      {
        error: `Cannot delete scheduled post in status ${existing.status}`,
        code: "INVALID_STATE",
      },
      { status: 409 },
    );
  }

  await prisma.scheduledPost.delete({ where: { id } });
  await removePendingQueueJob(id);

  return NextResponse.json({ ok: true });
}
