import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildRedditProfileChecklist } from "@/lib/reddit/profileChecklist";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const DEFAULT_COMMENT_FIRST_MIN_COMMENTS = 3;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const accountId = ctx.params.id;
  const account = await prisma.redditAccount.findFirst({
    where: {
      id: accountId,
      workspaceId: session.workspaceId,
    },
    select: {
      id: true,
      redditUsername: true,
      scopes: true,
      accountAge: true,
      linkKarma: true,
      commentKarma: true,
      safetyTier: true,
      lastSyncAt: true,
      isActive: true,
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Reddit account not found", code: "REDDIT_ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const latestHealth = await prisma.accountHealthSnapshot.findFirst({
    where: {
      workspaceId: session.workspaceId,
      redditAccountId: account.id,
    },
    orderBy: { capturedAt: "desc" },
    select: { healthScore: true, capturedAt: true },
  });

  const publishedComments = await prisma.publishedItem.count({
    where: {
      workspaceId: session.workspaceId,
      redditAccountId: account.id,
      type: "COMMENT",
    },
  });

  const commentFirstMinComments = parsePositiveEnvInt(
    "COMMENT_FIRST_MIN_COMMENTS",
    DEFAULT_COMMENT_FIRST_MIN_COMMENTS,
  );

  const checklist = buildRedditProfileChecklist({
    scopes: account.scopes,
    accountAgeDays: account.accountAge,
    linkKarma: account.linkKarma,
    commentKarma: account.commentKarma,
    safetyTier: account.safetyTier,
    lastSyncAt: account.lastSyncAt,
    latestHealthScore: latestHealth?.healthScore ?? null,
    publishedComments,
    commentFirstMinComments,
  });

  return NextResponse.json({
    account: {
      id: account.id,
      redditUsername: account.redditUsername,
      safetyTier: account.safetyTier,
      isActive: account.isActive,
      accountAgeDays: account.accountAge,
      linkKarma: account.linkKarma,
      commentKarma: account.commentKarma,
      publishedComments,
      commentFirstMinComments,
      lastSyncAt: account.lastSyncAt,
      latestHealthScore: latestHealth?.healthScore ?? null,
      latestHealthCapturedAt: latestHealth?.capturedAt ?? null,
    },
    checklist,
  });
}
