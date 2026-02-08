import { UnrecoverableError } from "bullmq";
import type { Job } from "bullmq";
import { enqueueMetricsFetchJob } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { RedditApiError } from "@/lib/reddit/errors";
import { decryptToken, TokenCryptoError } from "@/lib/security/tokenCrypto";
import type { PublishJobData } from "@/lib/queue/enqueue";

function truncateError(err: unknown, max = 500) {
  const raw = err instanceof Error ? err.message : "Unknown worker failure";
  const compact = raw.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
}

function classifyFailure(err: unknown) {
  if (err instanceof RedditApiError) return { retryable: err.isRetryable };
  if (err instanceof TokenCryptoError) return { retryable: false };
  return { retryable: true };
}

async function submitPost(opts: {
  accessToken: string;
  subredditName: string;
  title: string | null;
  body: string;
}) {
  const userAgent = process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1";

  const body = new URLSearchParams();
  body.set("api_type", "json");
  body.set("kind", "self");
  body.set("sr", opts.subredditName);
  body.set("title", opts.title ?? "Untitled Post");
  body.set("text", opts.body);
  body.set("resubmit", "true");

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: body.toString(),
  });

  if (res.status === 429) {
    throw new RedditApiError({
      code: "REDDIT_RATE_LIMIT",
      message: "Reddit rate limit exceeded",
      httpStatus: 429,
      isRetryable: true,
    });
  }
  if (res.status === 401) {
    throw new RedditApiError({
      code: "REDDIT_AUTH_FAILED",
      message: "Reddit auth failed",
      httpStatus: 401,
      isRetryable: false,
    });
  }
  if (!res.ok) {
    throw new RedditApiError({
      code: res.status >= 500 ? "REDDIT_SERVER_ERROR" : "REDDIT_BAD_REQUEST",
      message: `Reddit submit failed (${res.status})`,
      httpStatus: res.status,
      isRetryable: res.status >= 500,
    });
  }

  const json = (await res.json()) as {
    json?: {
      errors?: Array<[string, string, string]>;
      data?: { id?: string; name?: string; url?: string };
    };
  };

  const errors = json.json?.errors ?? [];
  if (errors.length > 0) {
    throw new RedditApiError({
      code: "REDDIT_BAD_REQUEST",
      message: `Reddit submit rejected: ${errors[0]?.[1] ?? "unknown_error"}`,
      httpStatus: 400,
      isRetryable: false,
    });
  }

  const data = json.json?.data;
  if (!data?.id || !data?.name || !data?.url) {
    throw new Error("SUBMIT_RESPONSE_MISSING_DATA");
  }

  return {
    redditId: data.id,
    redditFullname: data.name,
    permalink: data.url,
  };
}

export async function processPublishJob(job: Job<PublishJobData>) {
  if (!job.data.scheduledPostId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id: job.data.scheduledPostId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      attempts: true,
      draft: {
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          status: true,
        },
      },
      subreddit: {
        select: {
          id: true,
          name: true,
        },
      },
      redditAccount: {
        select: {
          id: true,
          accessToken: true,
          isActive: true,
        },
      },
    },
  });

  if (!scheduledPost) {
    throw new UnrecoverableError("SCHEDULED_POST_NOT_FOUND");
  }
  if (
    scheduledPost.status !== "SCHEDULED" &&
    scheduledPost.status !== "FAILED_RETRYABLE"
  ) {
    throw new UnrecoverableError(`INVALID_STATUS:${scheduledPost.status}`);
  }
  if (scheduledPost.draft.status !== "APPROVED") {
    await prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: "FAILED_PERMANENT",
        attempts: { increment: 1 },
        lastError: "DRAFT_NOT_APPROVED",
      },
    });
    throw new UnrecoverableError("DRAFT_NOT_APPROVED");
  }
  if (!scheduledPost.redditAccount.isActive) {
    await prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: "FAILED_PERMANENT",
        attempts: { increment: 1 },
        lastError: "REDDIT_ACCOUNT_INACTIVE",
      },
    });
    throw new UnrecoverableError("REDDIT_ACCOUNT_INACTIVE");
  }

  await prisma.scheduledPost.update({
    where: { id: scheduledPost.id },
    data: {
      status: "PUBLISHING",
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  try {
    if (scheduledPost.draft.type !== "POST") {
      throw new UnrecoverableError("COMMENT_PUBLISH_NOT_SUPPORTED_YET");
    }

    const accessToken = decryptToken(scheduledPost.redditAccount.accessToken);
    const submitted = await submitPost({
      accessToken,
      subredditName: scheduledPost.subreddit.name,
      title: scheduledPost.draft.title,
      body: scheduledPost.draft.body,
    });

    const published = await prisma.$transaction(async (tx) => {
      const created = await tx.publishedItem.create({
        data: {
          workspaceId: scheduledPost.workspaceId,
          redditAccountId: scheduledPost.redditAccount.id,
          subredditId: scheduledPost.subreddit.id,
          scheduledPostId: scheduledPost.id,
          type: "POST",
          redditFullname: submitted.redditFullname,
          redditId: submitted.redditId,
          permalink: submitted.permalink,
          titleSnapshot: scheduledPost.draft.title,
          bodySnapshot: scheduledPost.draft.body,
        },
        select: { id: true },
      });

      await tx.scheduledPost.update({
        where: { id: scheduledPost.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedItemId: created.id,
          lastError: null,
        },
      });
      return created;
    });

    await enqueueMetricsFetchJob({ publishedItemId: published.id });

    return {
      scheduledPostId: scheduledPost.id,
      publishedItemId: published.id,
      status: "published",
    };
  } catch (err) {
    const { retryable } = classifyFailure(err);
    await prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT",
        lastError: truncateError(err),
      },
    });

    if (!retryable) {
      throw new UnrecoverableError(truncateError(err));
    }
    throw err instanceof Error ? err : new Error("PUBLISH_FAILED");
  }
}
