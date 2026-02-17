import type { Job } from "bullmq";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledPost: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    accountHealthSnapshot: {
      findFirst: jest.fn(),
    },
    publishedItem: {
      count: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    performanceSnapshot: {
      create: jest.fn(),
    },
    visibilityCheck: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/reddit/client", () => ({
  redditFetch: jest.fn(),
  enforceRedditAccountRateLimit: jest.fn(),
}));

jest.mock("@/lib/locks/distributed", () => ({
  acquireDistributedLock: jest.fn(),
}));

jest.mock("@/lib/security/tokenCrypto", () => ({
  TokenCryptoError: class TokenCryptoError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  decryptToken: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueMetricsFetchJob: jest.fn(),
}));

import { RedditApiError } from "@/lib/reddit/errors";
import { processPublishJob } from "@/workers/publishWorker";
import { processMetricsFetchJob } from "@/workers/metricsWorker";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  scheduledPost: { findUnique: jest.Mock; update: jest.Mock };
  accountHealthSnapshot: { findFirst: jest.Mock };
  publishedItem: { count: jest.Mock; upsert: jest.Mock; findUnique: jest.Mock };
  performanceSnapshot: { create: jest.Mock };
  visibilityCheck: { create: jest.Mock };
};

const mockedRedditClient = jest.requireMock("@/lib/reddit/client") as {
  redditFetch: jest.Mock;
  enforceRedditAccountRateLimit: jest.Mock;
};

const mockedTokenCrypto = jest.requireMock("@/lib/security/tokenCrypto") as {
  decryptToken: jest.Mock;
};

const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueMetricsFetchJob: jest.Mock;
};
const mockedLocks = jest.requireMock("@/lib/locks/distributed") as {
  acquireDistributedLock: jest.Mock;
};

const baseScheduledPost = {
  id: "sp_1",
  workspaceId: "ws_1",
  redditAccountId: "ra_1",
  subredditId: "sub_1",
  status: "SCHEDULED",
  publishedAt: null,
  publishedItemId: null,
  draft: {
    id: "d_1",
    type: "POST",
    title: "Title",
    body: "Body",
    status: "APPROVED",
    riskScore: 10,
    generationParams: null,
  },
  redditAccount: {
    id: "ra_1",
    accessToken: "rfenc.v1.iv.ct.tag",
    scopes: ["submit", "read"],
    safetyTier: "ESTABLISHED",
    isActive: true,
  },
  subreddit: { id: "sub_1", name: "startups" },
  publishedItem: null,
};

const basePublishedItem = {
  id: "pi_1",
  workspaceId: "ws_1",
  redditAccountId: "ra_1",
  redditFullname: "t3_abc123",
  permalink: "/r/startups/comments/abc123/example/",
  redditAccount: {
    id: "ra_1",
    accessToken: "rfenc.v1.iv.ct.tag",
    scopes: ["read"],
    isActive: true,
  },
};

describe("worker processors", () => {
  const originalCommunityThreshold =
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "0";
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue(null);
    mockedRedditClient.enforceRedditAccountRateLimit.mockResolvedValue({
      remaining: 42,
    });
    mockedLocks.acquireDistributedLock
      .mockResolvedValueOnce({
        acquired: true,
        release: jest.fn().mockResolvedValue(undefined),
      })
      .mockResolvedValue({
        acquired: true,
        release: jest.fn().mockResolvedValue(undefined),
      });
  });

  afterEach(() => {
    if (typeof originalCommunityThreshold === "string") {
      process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = originalCommunityThreshold;
      return;
    }
    delete process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;
  });

  test("processPublishJob success path publishes and enqueues metrics", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue(baseScheduledPost);
    mockedPrisma.publishedItem.count.mockResolvedValue(0);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockResolvedValue({
      data: {
        json: {
          data: {
            name: "t3_abc123",
            id: "abc123",
            permalink: "/r/startups/comments/abc123/example/",
            url: "https://reddit.com/r/startups/comments/abc123/example/",
          },
        },
      },
    });
    mockedPrisma.publishedItem.upsert.mockResolvedValue({ id: "pi_1" });
    mockedQueue.enqueueMetricsFetchJob.mockResolvedValue({ id: "job_m_1" });

    const job = {
      id: "job_p_1",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).resolves.toEqual({
      scheduledPostId: "sp_1",
      publishedItemId: "pi_1",
      status: "published",
    });

    expect(mockedRedditClient.redditFetch).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.publishedItem.upsert).toHaveBeenCalledTimes(1);
    expect(mockedQueue.enqueueMetricsFetchJob).toHaveBeenCalledWith({
      publishedItemId: "pi_1",
    });
  });

  test("processPublishJob classifies retryable Reddit server errors", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue(baseScheduledPost);
    mockedPrisma.publishedItem.count.mockResolvedValue(0);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockRejectedValue(
      new RedditApiError({
        code: "REDDIT_SERVER_ERROR",
        message: "Server unavailable",
        httpStatus: 503,
        isRetryable: true,
      }),
    );

    const job = {
      id: "job_p_retry",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).rejects.toThrow("REDDIT_SERVER_ERROR");

    expect(mockedPrisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED_RETRYABLE" }),
      }),
    );
  });

  test("processPublishJob classifies permanent preflight failures", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      ...baseScheduledPost,
      redditAccount: { ...baseScheduledPost.redditAccount, scopes: ["read"] },
    });

    const job = {
      id: "job_p_perm",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).rejects.toThrow("INVALID_AUTH_SCOPE");

    expect(mockedRedditClient.redditFetch).not.toHaveBeenCalled();
    expect(mockedPrisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED_PERMANENT" }),
      }),
    );
  });

  test("processPublishJob returns retryable when scheduled lock not acquired", async () => {
    mockedLocks.acquireDistributedLock.mockReset();
    mockedLocks.acquireDistributedLock.mockResolvedValueOnce({
      acquired: false,
      release: jest.fn().mockResolvedValue(undefined),
    });

    const job = {
      id: "job_p_lock_busy",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).rejects.toThrow(
      "DISTRIBUTED_LOCK_NOT_ACQUIRED",
    );
    expect(mockedPrisma.scheduledPost.findUnique).not.toHaveBeenCalled();
  });

  test("processPublishJob blocks NEW account posts before comment threshold", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      ...baseScheduledPost,
      redditAccount: { ...baseScheduledPost.redditAccount, safetyTier: "NEW" },
      draft: { ...baseScheduledPost.draft, type: "POST" },
    });
    mockedPrisma.publishedItem.count.mockResolvedValue(0);

    const job = {
      id: "job_p_comment_first",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).rejects.toThrow(
      "COMMENT_FIRST_REQUIRED",
    );
    expect(mockedRedditClient.redditFetch).not.toHaveBeenCalled();
  });

  test("processPublishJob blocks posts when community engagement threshold is unmet", async () => {
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "2";
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue(baseScheduledPost);
    mockedPrisma.publishedItem.count.mockResolvedValue(0);

    const job = {
      id: "job_p_engagement_threshold",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).rejects.toThrow(
      "COMMUNITY_ENGAGEMENT_REQUIRED",
    );
    expect(mockedRedditClient.redditFetch).not.toHaveBeenCalled();
  });

  test("processPublishJob does not apply health block to comment drafts", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      ...baseScheduledPost,
      draft: {
        ...baseScheduledPost.draft,
        type: "COMMENT",
        title: null,
        generationParams: { parentThingId: "t3_parent123" },
      },
    });
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      healthScore: 12,
    });
    mockedPrisma.publishedItem.count.mockResolvedValue(0);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockResolvedValue({
      data: {
        json: {
          data: {
            name: "t1_comment123",
            id: "comment123",
            permalink: "/r/startups/comments/post123/comment123/",
            url: "https://reddit.com/r/startups/comments/post123/comment123/",
          },
        },
      },
    });
    mockedPrisma.publishedItem.upsert.mockResolvedValue({ id: "pi_comment_1" });
    mockedQueue.enqueueMetricsFetchJob.mockResolvedValue({ id: "job_m_2" });

    const job = {
      id: "job_p_comment_health_ok",
      attemptsStarted: 1,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).resolves.toEqual({
      scheduledPostId: "sp_1",
      publishedItemId: "pi_comment_1",
      status: "published",
    });
    expect(mockedRedditClient.redditFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/comment" }),
    );
  });

  test("processPublishJob is idempotent when already published", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      ...baseScheduledPost,
      status: "PUBLISHED",
      publishedItemId: "pi_existing",
    });

    const job = {
      id: "job_p_idempotent",
      attemptsStarted: 2,
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;

    await expect(processPublishJob(job)).resolves.toEqual({
      scheduledPostId: "sp_1",
      publishedItemId: "pi_existing",
      status: "already_published",
    });

    expect(mockedRedditClient.redditFetch).not.toHaveBeenCalled();
    expect(mockedPrisma.publishedItem.upsert).not.toHaveBeenCalled();
  });

  test("processMetricsFetchJob success path captures snapshot", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue(basePublishedItem);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockResolvedValue({
      data: {
        data: {
          children: [
            {
              data: {
                score: 12,
                ups: 14,
                downs: 2,
                upvote_ratio: 0.9,
                num_comments: 5,
                removed_by_category: null,
                locked: false,
                stickied: false,
              },
            },
          ],
        },
      },
    });
    mockedPrisma.performanceSnapshot.create.mockResolvedValue({ id: "snap_1" });

    const job = {
      id: "job_m_1",
      attemptsStarted: 1,
      data: { publishedItemId: "pi_1" },
    } as unknown as Job<{ publishedItemId: string }>;

    await expect(processMetricsFetchJob(job)).resolves.toEqual({
      publishedItemId: "pi_1",
      snapshotId: "snap_1",
      status: "captured",
    });

    expect(mockedPrisma.performanceSnapshot.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.visibilityCheck.create).not.toHaveBeenCalled();
  });

  test("processMetricsFetchJob classifies retryable failures", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue(basePublishedItem);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockRejectedValue(
      new RedditApiError({
        code: "REDDIT_RATE_LIMIT",
        message: "Too many requests",
        httpStatus: 429,
        isRetryable: true,
      }),
    );

    const job = {
      id: "job_m_retry",
      attemptsStarted: 1,
      data: { publishedItemId: "pi_1" },
    } as unknown as Job<{ publishedItemId: string }>;

    await expect(processMetricsFetchJob(job)).rejects.toThrow(
      "REDDIT_RATE_LIMIT",
    );
    expect(mockedPrisma.performanceSnapshot.create).not.toHaveBeenCalled();
  });

  test("processMetricsFetchJob classifies permanent missing entity failures", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue(null);

    const job = {
      id: "job_m_perm",
      attemptsStarted: 1,
      data: { publishedItemId: "pi_missing" },
    } as unknown as Job<{ publishedItemId: string }>;

    await expect(processMetricsFetchJob(job)).rejects.toThrow(
      "PUBLISHED_ITEM_NOT_FOUND",
    );
    expect(mockedRedditClient.redditFetch).not.toHaveBeenCalled();
  });

  test("processMetricsFetchJob keeps history on reruns", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue(basePublishedItem);
    mockedTokenCrypto.decryptToken.mockReturnValue("access-token");
    mockedRedditClient.redditFetch.mockResolvedValue({
      data: {
        data: {
          children: [
            {
              data: {
                score: 1,
                ups: 1,
                downs: 0,
                upvote_ratio: 1,
                num_comments: 0,
                removed_by_category: null,
                locked: false,
                stickied: false,
              },
            },
          ],
        },
      },
    });
    mockedPrisma.performanceSnapshot.create
      .mockResolvedValueOnce({ id: "snap_1" })
      .mockResolvedValueOnce({ id: "snap_2" });

    const job = {
      id: "job_m_rerun",
      attemptsStarted: 1,
      data: { publishedItemId: "pi_1" },
    } as unknown as Job<{ publishedItemId: string }>;

    await processMetricsFetchJob(job);
    await processMetricsFetchJob(job);

    expect(mockedPrisma.performanceSnapshot.create).toHaveBeenCalledTimes(2);
  });
});
