import { NextResponse } from "next/server";
import { getHealthGuardrailThresholds } from "@/lib/health/guardrails";
import { prisma } from "@/lib/prisma";
import { enqueueRiskAccountHealthJob } from "@/lib/queue/enqueue";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const parsedStaleHours = Number(process.env.HEALTH_SNAPSHOT_STALE_HOURS);
const STALE_HOURS =
  Number.isFinite(parsedStaleHours) && parsedStaleHours > 0
    ? Math.floor(parsedStaleHours)
    : 24;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  if (code === "WORKSPACE_REQUIRED") {
    return NextResponse.json(
      { error: "Workspace required", code },
      { status: 400 },
    );
  }
  if (code === "SUPABASE_NOT_CONFIGURED") {
    return NextResponse.json(
      { error: "Supabase is not configured", code },
      { status: 500 },
    );
  }
  if (code === "USER_NOT_SYNCED") {
    return NextResponse.json(
      { error: "User is not synced", code },
      { status: 409 },
    );
  }
  if (code === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized", code }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Failed to resolve workspace session", code },
    { status: 500 },
  );
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const redditAccountId = ctx.params.id;
  const healthThresholds = getHealthGuardrailThresholds();
  const account = await prisma.redditAccount.findFirst({
    where: {
      id: redditAccountId,
      workspace: { members: { some: { userId: session.user.id } } },
    },
    select: {
      id: true,
      workspaceId: true,
      redditUsername: true,
      safetyTier: true,
      isActive: true,
    },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Reddit account not found", code: "REDDIT_ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const latest = await prisma.accountHealthSnapshot.findFirst({
    where: {
      workspaceId: account.workspaceId,
      redditAccountId,
    },
    orderBy: { capturedAt: "desc" },
  });

  const ageHours = latest
    ? (Date.now() - latest.capturedAt.getTime()) / (1000 * 60 * 60)
    : null;
  const staleHours =
    ageHours === null ? null : Math.max(0, Math.floor(ageHours));
  const snapshotInFuture = ageHours !== null && ageHours < 0;
  const shouldQueueRefresh =
    account.isActive &&
    (!latest ||
      snapshotInFuture ||
      (staleHours !== null && staleHours >= STALE_HOURS));
  let refreshQueued = false;

  if (shouldQueueRefresh) {
    try {
      await enqueueRiskAccountHealthJob({
        workspaceId: account.workspaceId,
        redditAccountId,
      });
      refreshQueued = true;
    } catch {
      // keep response graceful even when queue is unavailable
    }
  }

  const warnings: string[] = [];
  const latestHealthScore =
    latest && Number.isFinite(latest.healthScore) ? latest.healthScore : null;

  if (!account.isActive) warnings.push("Reddit account is inactive.");
  if (latest && latestHealthScore === null) {
    warnings.push(
      "Latest health snapshot is invalid. Refresh account health before scheduling posts.",
    );
  } else if (
    latestHealthScore !== null &&
    latestHealthScore < healthThresholds.caution
  ) {
    warnings.push("Health score is low. Prefer comments and slower pacing.");
  }
  if (account.safetyTier === "RESTRICTED") {
    warnings.push(
      "Account is restricted. Avoid post scheduling until recovered.",
    );
  }

  return NextResponse.json({
    account,
    latestSnapshot: latest,
    staleHours,
    refreshQueued,
    warnings,
    guardrails: {
      blockPublishing:
        account.safetyTier === "RESTRICTED" ||
        (latestHealthScore ?? 100) < healthThresholds.blockPublishing,
      recommendCommentsOnly:
        account.safetyTier === "NEW" ||
        account.safetyTier === "RESTRICTED" ||
        (latestHealthScore ?? 100) < healthThresholds.caution,
    },
  });
}
