import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueRiskAccountHealthJob } from "@/lib/queue/enqueue";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const redditAccountId = ctx.params.id;
  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId: session.workspaceId },
    select: {
      id: true,
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
      workspaceId: session.workspaceId,
      redditAccountId,
    },
    orderBy: { capturedAt: "desc" },
  });

  if (!latest) {
    try {
      await enqueueRiskAccountHealthJob({
        workspaceId: session.workspaceId,
        redditAccountId,
      });
    } catch {
      // keep response graceful even when queue is unavailable
    }
  }

  const warnings: string[] = [];
  if (!account.isActive) warnings.push("Reddit account is inactive.");
  if (latest && latest.healthScore < 45) {
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
    warnings,
    guardrails: {
      blockPublishing:
        account.safetyTier === "RESTRICTED" ||
        (latest?.healthScore ?? 100) < 30,
      recommendCommentsOnly:
        account.safetyTier === "NEW" || (latest?.healthScore ?? 100) < 45,
    },
  });
}
