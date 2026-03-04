import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";

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
  try {
    const accountId = ctx.params.id.trim();
    if (!accountId) {
      return NextResponse.json(
        { error: "Account id is required", code: "ACCOUNT_ID_REQUIRED" },
        { status: 400 },
      );
    }

    const entitlements = await getWorkspaceEntitlements(session.workspaceId);
    if (!entitlements.hasAdvancedAnalytics) {
      return NextResponse.json(
        {
          error: "Advanced analytics is available on paid plans",
          code: "ADVANCED_ANALYTICS_REQUIRED",
        },
        { status: 403 },
      );
    }

    const account = await prisma.redditAccount.findFirst({
      where: { id: accountId, workspaceId: session.workspaceId },
      select: {
        id: true,
        redditUsername: true,
        safetyTier: true,
        isActive: true,
        linkKarma: true,
        commentKarma: true,
      },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Reddit account not found", code: "REDDIT_ACCOUNT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const [scheduledStatusCounts, publishedItems] = await Promise.all([
      prisma.scheduledPost.groupBy({
        by: ["status"],
        where: {
          workspaceId: session.workspaceId,
          redditAccountId: accountId,
        },
        _count: { _all: true },
      }),
      prisma.publishedItem.findMany({
        where: {
          workspaceId: session.workspaceId,
          redditAccountId: accountId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          type: true,
          permalink: true,
          createdAt: true,
          subreddit: { select: { id: true, name: true, title: true } },
          snapshots: {
            orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              score: true,
              upvoteRatio: true,
              numComments: true,
              isRemoved: true,
              removalReason: true,
              capturedAt: true,
            },
          },
        },
      }),
    ]);

    const statusCounts = scheduledStatusCounts.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
      },
      {},
    );

    let totalScore = 0;
    let totalComments = 0;
    let removedCount = 0;
    let latestCapturedAt: Date | null = null;
    const items = publishedItems.map((item) => {
      const latest = item.snapshots[0] ?? null;
      if (latest) {
        totalScore += latest.score;
        totalComments += latest.numComments;
        if (latest.isRemoved) removedCount += 1;
        if (!latestCapturedAt || latest.capturedAt > latestCapturedAt) {
          latestCapturedAt = latest.capturedAt;
        }
      }
      return {
        id: item.id,
        type: item.type,
        permalink: item.permalink,
        createdAt: item.createdAt,
        subreddit: item.subreddit,
        latestSnapshot: latest,
      };
    });

    const publishedCount = items.length;
    return NextResponse.json({
      account,
      summary: {
        publishedCount,
        scheduledCount: statusCounts.SCHEDULED ?? 0,
        publishingCount: statusCounts.PUBLISHING ?? 0,
        failedCount:
          (statusCounts.FAILED_RETRYABLE ?? 0) +
          (statusCounts.FAILED_PERMANENT ?? 0),
        cancelledCount: statusCounts.CANCELLED ?? 0,
        removedCount,
        totalScore,
        avgScore: publishedCount ? totalScore / publishedCount : 0,
        totalComments,
        avgComments: publishedCount ? totalComments / publishedCount : 0,
        latestCapturedAt,
      },
      items,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to load account analytics",
        code: "ANALYTICS_ACCOUNT_FETCH_FAILED",
      },
      { status: 500 },
    );
  }
}
