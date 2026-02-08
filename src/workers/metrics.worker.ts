import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redditFetch } from "@/lib/reddit/client";
import { RedditApiError } from "@/lib/reddit/errors";
import { decryptToken, TokenCryptoError } from "@/lib/security/tokenCrypto";
import type { MetricsFetchJobData } from "@/lib/queue/enqueue";

function truncateError(err: unknown, max = 500) {
  const raw = err instanceof Error ? err.message : "Unknown worker failure";
  const compact = raw.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
}

export async function processMetricsFetchJob(job: Job<MetricsFetchJobData>) {
  if (!job.data.publishedItemId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const item = await prisma.publishedItem.findUnique({
    where: { id: job.data.publishedItemId },
    select: {
      id: true,
      redditFullname: true,
      redditAccount: {
        select: {
          id: true,
          accessToken: true,
        },
      },
    },
  });
  if (!item) {
    throw new UnrecoverableError("PUBLISHED_ITEM_NOT_FOUND");
  }

  try {
    const accessToken = decryptToken(item.redditAccount.accessToken);
    const { data } = await redditFetch<{
      data?: {
        children?: Array<{
          data?: {
            score?: number;
            ups?: number;
            downs?: number;
            upvote_ratio?: number;
            num_comments?: number;
            removed?: boolean;
            removed_by_category?: string | null;
            locked?: boolean;
            stickied?: boolean;
          };
        }>;
      };
    }>({
      redditAccountId: item.redditAccount.id,
      accessToken,
      path: "/api/info",
      query: { id: item.redditFullname },
    });

    const post = data.data?.children?.[0]?.data;
    if (!post) {
      throw new UnrecoverableError("REDDIT_POST_NOT_FOUND");
    }

    await prisma.performanceSnapshot.create({
      data: {
        publishedItemId: item.id,
        score: post.score ?? 0,
        upvotes: post.ups ?? 0,
        downvotes: post.downs ?? 0,
        upvoteRatio: post.upvote_ratio ?? null,
        numComments: post.num_comments ?? 0,
        isRemoved: Boolean(post.removed || post.removed_by_category),
        removalReason: post.removed_by_category ?? null,
        isLocked: Boolean(post.locked),
        isStickied: Boolean(post.stickied),
        rawData: data as unknown as Prisma.InputJsonValue,
        capturedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof UnrecoverableError) throw err;
    if (err instanceof TokenCryptoError) {
      throw new UnrecoverableError(`TOKEN_DECRYPT_FAILED:${err.code}`);
    }
    if (err instanceof RedditApiError && !err.isRetryable) {
      throw new UnrecoverableError(truncateError(err));
    }
    throw err instanceof Error ? err : new Error("METRICS_FETCH_FAILED");
  }

  return {
    publishedItemId: item.id,
    status: "captured",
  };
}
