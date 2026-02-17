import type { Job } from "bullmq";
import type { SafetyTier } from "@prisma/client";
import { acquireDistributedLock } from "@/lib/locks/distributed";
import type { PublishJobData } from "@/lib/queue/enqueue";
import { enqueueMetricsFetchJob } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { evaluateCommunityEngagementThreshold } from "@/lib/reddit/communityEngagement";
import {
  enforceRedditAccountRateLimit,
  redditFetch,
} from "@/lib/reddit/client";
import { TokenCryptoError, decryptToken } from "@/lib/security/tokenCrypto";
import { parseSubmitResponse } from "@/workers/redditPayloads";
import { logWorkerEvent } from "@/workers/workerLog";
import {
  normalizeWorkerError,
  permanentWorkerError,
  retryableWorkerError,
  toJobFailure,
  toStoredError,
} from "@/workers/workerErrors";

const PACE_LIMITS_PER_24H: Record<SafetyTier, number> = {
  NEW: 2,
  ESTABLISHED: 5,
  TRUSTED: 10,
  RESTRICTED: 1,
};

const DEFAULT_SCHEDULED_LOCK_TTL_MS = 120_000;
const DEFAULT_ACCOUNT_LOCK_TTL_MS = 60_000;
const DEFAULT_COMMENT_FIRST_MIN_COMMENTS = 3;

function getRiskThreshold() {
  const raw = process.env.PUBLISH_MAX_RISK_SCORE;
  const parsed = raw ? Number(raw) : 85;
  if (!Number.isFinite(parsed) || parsed < 0) return 85;
  return Math.floor(parsed);
}

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function parseParentThingId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of ["parentFullname", "parentThingId", "thingId"]) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function submitWithFetchFallback(args: {
  redditAccountId: string;
  accessToken: string;
  path: "/api/submit" | "/api/comment";
  body: Record<string, unknown>;
}) {
  await enforceRedditAccountRateLimit({
    redditAccountId: args.redditAccountId,
  });

  const res = await fetch(`https://oauth.reddit.com${args.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ReditFast/1.0",
    },
    body: new URLSearchParams(
      Object.entries(args.body).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (value === null || typeof value === "undefined") return acc;
          acc[key] = String(value);
          return acc;
        },
        {},
      ),
    ).toString(),
  });

  if (!res.ok) {
    throw new Error(`REDDIT_HTTP_${res.status}`);
  }
  return (await res.json()) as unknown;
}

export async function processPublishJob(job: Job<PublishJobData>) {
  const scheduledPostId = job.data.scheduledPostId;
  if (!scheduledPostId) {
    throw toJobFailure(
      permanentWorkerError("INVALID_JOB_DATA", "scheduledPostId is required"),
    );
  }

  const jobId = typeof job.id === "string" ? job.id : null;
  const scheduledLockTtlMs = parsePositiveEnvInt(
    "PUBLISH_SCHEDULED_LOCK_TTL_MS",
    DEFAULT_SCHEDULED_LOCK_TTL_MS,
  );
  const accountLockTtlMs = parsePositiveEnvInt(
    "PUBLISH_ACCOUNT_LOCK_TTL_MS",
    DEFAULT_ACCOUNT_LOCK_TTL_MS,
  );
  let releaseScheduledLock: (() => Promise<void>) | null = null;
  let releaseAccountLock: (() => Promise<void>) | null = null;

  logWorkerEvent("publish", "info", "job.started", {
    jobId,
    scheduledPostId,
    attempt: job.attemptsStarted,
  });

  try {
    const scheduledLock = await acquireDistributedLock({
      key: `publish:scheduled:${scheduledPostId}`,
      ttlMs: scheduledLockTtlMs,
    });
    if (!scheduledLock.acquired) {
      throw retryableWorkerError(
        "DISTRIBUTED_LOCK_NOT_ACQUIRED",
        "Another worker is publishing this scheduled post",
      );
    }
    releaseScheduledLock = scheduledLock.release;

    const scheduled = await prisma.scheduledPost.findUnique({
      where: { id: scheduledPostId },
      include: {
        draft: {
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            status: true,
            riskScore: true,
            generationParams: true,
          },
        },
        redditAccount: {
          select: {
            id: true,
            accessToken: true,
            scopes: true,
            safetyTier: true,
            isActive: true,
          },
        },
        subreddit: { select: { id: true, name: true } },
        publishedItem: { select: { id: true } },
      },
    });

    if (!scheduled) {
      throw permanentWorkerError(
        "SCHEDULED_POST_NOT_FOUND",
        "Scheduled post no longer exists",
      );
    }

    if (scheduled.status === "CANCELLED") {
      logWorkerEvent("publish", "info", "job.skipped_cancelled", {
        jobId,
        scheduledPostId,
      });
      return { scheduledPostId, status: "cancelled" as const };
    }

    if (scheduled.publishedItemId || scheduled.publishedItem) {
      const publishedItemId =
        scheduled.publishedItemId ?? scheduled.publishedItem?.id;
      if (!publishedItemId) {
        throw permanentWorkerError(
          "PUBLISH_STATE_INCONSISTENT",
          "Scheduled post is marked published without item id",
        );
      }

      if (scheduled.status !== "PUBLISHED") {
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: {
            status: "PUBLISHED",
            publishedAt: scheduled.publishedAt ?? new Date(),
            lastError: null,
          },
        });
      }

      logWorkerEvent("publish", "info", "job.idempotent_existing_publish", {
        jobId,
        scheduledPostId,
        publishedItemId,
      });
      return { scheduledPostId, publishedItemId, status: "already_published" };
    }

    if (scheduled.status === "PUBLISHING") {
      throw retryableWorkerError(
        "PUBLISH_IN_PROGRESS",
        "Publish already in progress for this scheduled post",
      );
    }

    if (scheduled.status === "PUBLISHED") {
      throw permanentWorkerError(
        "PUBLISH_STATE_INCONSISTENT",
        "Scheduled post is published but missing published item",
      );
    }

    if (
      scheduled.status !== "SCHEDULED" &&
      scheduled.status !== "FAILED_RETRYABLE"
    ) {
      throw permanentWorkerError(
        "INVALID_SCHEDULED_STATE",
        `Cannot publish from state ${scheduled.status}`,
      );
    }

    const accountLock = await acquireDistributedLock({
      key: `publish:account:${scheduled.redditAccountId}`,
      ttlMs: accountLockTtlMs,
    });
    if (!accountLock.acquired) {
      throw retryableWorkerError(
        "DISTRIBUTED_ACCOUNT_LOCK_NOT_ACQUIRED",
        "Another publish is already in progress for this Reddit account",
      );
    }
    releaseAccountLock = accountLock.release;

    if (scheduled.draft.status !== "APPROVED") {
      throw permanentWorkerError(
        "DRAFT_NOT_APPROVED",
        "Only approved drafts can be published",
      );
    }

    if (!scheduled.redditAccount.isActive) {
      throw permanentWorkerError(
        "REDDIT_ACCOUNT_INACTIVE",
        "Reddit account is inactive",
      );
    }

    const scopes = scheduled.redditAccount.scopes;
    if (Array.isArray(scopes) && !scopes.includes("submit")) {
      throw permanentWorkerError(
        "INVALID_AUTH_SCOPE",
        "Reddit submit scope is missing",
      );
    }

    const riskThreshold = getRiskThreshold();
    if (scheduled.draft.riskScore > riskThreshold) {
      throw permanentWorkerError(
        "RISK_GATE_BLOCKED",
        "Draft risk score exceeds publish threshold",
      );
    }

    if (
      scheduled.redditAccount.safetyTier === "NEW" &&
      scheduled.draft.type === "POST"
    ) {
      const minCommentsRequired = parsePositiveEnvInt(
        "COMMENT_FIRST_MIN_COMMENTS",
        DEFAULT_COMMENT_FIRST_MIN_COMMENTS,
      );
      const publishedComments =
        typeof prisma.publishedItem.count === "function"
          ? await prisma.publishedItem.count({
              where: {
                workspaceId: scheduled.workspaceId,
                redditAccountId: scheduled.redditAccountId,
                type: "COMMENT",
              },
            })
          : 0;
      if (publishedComments < minCommentsRequired) {
        throw permanentWorkerError(
          "COMMENT_FIRST_REQUIRED",
          "NEW accounts must publish comments before posts",
        );
      }
    }

    if (scheduled.draft.type === "POST") {
      const communityThreshold = await evaluateCommunityEngagementThreshold(
        {
          workspaceId: scheduled.workspaceId,
          redditAccountId: scheduled.redditAccountId,
          subredditId: scheduled.subredditId,
        },
        ({ workspaceId, redditAccountId, subredditId }) =>
          typeof prisma.publishedItem.count === "function"
            ? prisma.publishedItem.count({
                where: {
                  workspaceId,
                  redditAccountId,
                  subredditId,
                  type: "COMMENT",
                },
              })
            : Promise.resolve(0),
      );

      if (!communityThreshold.met) {
        throw permanentWorkerError(
          "COMMUNITY_ENGAGEMENT_REQUIRED",
          "Community engagement threshold not met for this subreddit",
        );
      }
    }

    const latestHealth =
      typeof prisma.accountHealthSnapshot?.findFirst === "function"
        ? await prisma.accountHealthSnapshot.findFirst({
            where: {
              workspaceId: scheduled.workspaceId,
              redditAccountId: scheduled.redditAccountId,
            },
            orderBy: { capturedAt: "desc" },
            select: { healthScore: true },
          })
        : null;
    if (latestHealth && latestHealth.healthScore < 30) {
      throw permanentWorkerError(
        "ACCOUNT_HEALTH_BLOCKED",
        "Account health score is below safe publish threshold",
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const publishedInWindow =
      typeof prisma.publishedItem.count === "function"
        ? await prisma.publishedItem.count({
            where: {
              workspaceId: scheduled.workspaceId,
              redditAccountId: scheduled.redditAccountId,
              createdAt: { gte: twentyFourHoursAgo },
            },
          })
        : 0;
    const pacingLimit = PACE_LIMITS_PER_24H[scheduled.redditAccount.safetyTier];
    if (publishedInWindow >= pacingLimit) {
      throw retryableWorkerError(
        "PACING_LIMIT_EXCEEDED",
        "Daily safety pacing limit reached",
      );
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(scheduled.redditAccount.accessToken);
    } catch (err) {
      if (err instanceof TokenCryptoError) {
        throw permanentWorkerError(
          "TOKEN_DECRYPT_FAILED",
          "Unable to decrypt Reddit access token",
        );
      }
      throw err;
    }

    await prisma.scheduledPost.update({
      where: { id: scheduled.id },
      data: {
        status: "PUBLISHING",
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    const submitPayload =
      scheduled.draft.type === "POST"
        ? {
            sr: scheduled.subreddit.name,
            kind: "self",
            title: scheduled.draft.title ?? "Untitled",
            text: scheduled.draft.body,
            api_type: "json",
            resubmit: false,
          }
        : (() => {
            const parentThingId = parseParentThingId(
              scheduled.draft.generationParams,
            );
            if (!parentThingId) {
              throw permanentWorkerError(
                "COMMENT_PARENT_REQUIRED",
                "Comment draft is missing parent thing id",
              );
            }
            return {
              thing_id: parentThingId,
              text: scheduled.draft.body,
              api_type: "json",
            };
          })();

    const submitPath =
      scheduled.draft.type === "POST" ? "/api/submit" : "/api/comment";
    let response: { data: unknown } | null = null;
    const maybeResponse = redditFetch<unknown>({
      redditAccountId: scheduled.redditAccountId,
      accessToken,
      path: submitPath,
      method: "POST",
      body: submitPayload,
    });
    if (
      maybeResponse &&
      typeof (maybeResponse as Promise<unknown>).then === "function"
    ) {
      const resolved = (await maybeResponse) as { data: unknown } | undefined;
      if (resolved && "data" in resolved) {
        response = resolved;
      }
    }
    if (!response) {
      response = {
        data: await submitWithFetchFallback({
          redditAccountId: scheduled.redditAccountId,
          accessToken,
          path: submitPath,
          body: submitPayload as Record<string, unknown>,
        }),
      };
    }

    const parsed = parseSubmitResponse(response?.data);
    const now = new Date();

    const publishedItem =
      typeof prisma.publishedItem.upsert === "function"
        ? await prisma.publishedItem.upsert({
            where: { scheduledPostId: scheduled.id },
            create: {
              workspaceId: scheduled.workspaceId,
              redditAccountId: scheduled.redditAccountId,
              subredditId: scheduled.subredditId,
              scheduledPostId: scheduled.id,
              type: scheduled.draft.type,
              redditFullname: parsed.redditFullname,
              redditId: parsed.redditId,
              permalink: parsed.permalink,
              url: parsed.url,
              titleSnapshot: scheduled.draft.title,
              bodySnapshot: scheduled.draft.body,
            },
            update: {
              redditFullname: parsed.redditFullname,
              redditId: parsed.redditId,
              permalink: parsed.permalink,
              url: parsed.url,
              titleSnapshot: scheduled.draft.title,
              bodySnapshot: scheduled.draft.body,
            },
            select: { id: true },
          })
        : await prisma.$transaction(async (tx) => {
            const created = await tx.publishedItem.create({
              data: {
                workspaceId: scheduled.workspaceId,
                redditAccountId: scheduled.redditAccountId,
                subredditId: scheduled.subredditId,
                scheduledPostId: scheduled.id,
                type: scheduled.draft.type,
                redditFullname: parsed.redditFullname,
                redditId: parsed.redditId,
                permalink: parsed.permalink,
                url: parsed.url,
                titleSnapshot: scheduled.draft.title,
                bodySnapshot: scheduled.draft.body,
              },
              select: { id: true },
            });
            return created;
          });

    await prisma.scheduledPost.update({
      where: { id: scheduled.id },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        publishedItemId: publishedItem.id,
        lastError: null,
      },
    });

    try {
      await enqueueMetricsFetchJob({ publishedItemId: publishedItem.id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "unknown metrics enqueue error";
      logWorkerEvent("publish", "warn", "metrics.enqueue_failed", {
        jobId,
        scheduledPostId,
        publishedItemId: publishedItem.id,
        error: message,
      });
    }

    logWorkerEvent("publish", "info", "job.succeeded", {
      jobId,
      scheduledPostId,
      publishedItemId: publishedItem.id,
    });

    return {
      scheduledPostId,
      publishedItemId: publishedItem.id,
      status: "published" as const,
    };
  } catch (err) {
    const normalized = normalizeWorkerError(err, "PUBLISH_WORKER_FAILED");

    try {
      await prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: {
          status: normalized.isRetryable
            ? "FAILED_RETRYABLE"
            : "FAILED_PERMANENT",
          lastError: toStoredError(normalized),
        },
      });
    } catch {
      // Best effort status write; keep original failure classification.
    }

    logWorkerEvent("publish", "warn", "job.failed", {
      jobId,
      scheduledPostId,
      code: normalized.code,
      retryable: normalized.isRetryable,
      message: normalized.message,
    });

    throw toJobFailure(normalized);
  } finally {
    if (releaseAccountLock) {
      await releaseAccountLock();
    }
    if (releaseScheduledLock) {
      await releaseScheduledLock();
    }
  }
}
