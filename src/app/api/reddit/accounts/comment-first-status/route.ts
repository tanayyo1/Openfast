import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const DEFAULT_COMMENT_FIRST_MIN_COMMENTS = 3;

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const commentFirstMinComments = parsePositiveEnvInt(
    "COMMENT_FIRST_MIN_COMMENTS",
    DEFAULT_COMMENT_FIRST_MIN_COMMENTS,
  );

  const accounts = await prisma.redditAccount.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    select: {
      id: true,
      redditUsername: true,
      safetyTier: true,
    },
  });

  const accountIds = accounts.map((a) => a.id);

  const publishedCommentsByAccount = await prisma.publishedItem.groupBy({
    by: ["redditAccountId"],
    where: {
      workspaceId: session.workspaceId,
      redditAccountId: { in: accountIds },
      type: "COMMENT",
    },
    _count: true,
  });

  const commentCountsMap = new Map(
    publishedCommentsByAccount.map((r) => [r.redditAccountId, r._count]),
  );

  const statuses = accounts.map((account) => {
    const publishedComments = commentCountsMap.get(account.id) ?? 0;
    const isNewAccount = account.safetyTier === "NEW";
    const canSchedulePosts =
      !isNewAccount || publishedComments >= commentFirstMinComments;
    const remainingComments = isNewAccount
      ? Math.max(0, commentFirstMinComments - publishedComments)
      : 0;

    return {
      accountId: account.id,
      username: account.redditUsername,
      safetyTier: account.safetyTier,
      isNewAccount,
      publishedComments,
      requiredComments: commentFirstMinComments,
      canSchedulePosts,
      remainingComments,
    };
  });

  return NextResponse.json({
    requiredComments: commentFirstMinComments,
    accounts: statuses,
  });
}
