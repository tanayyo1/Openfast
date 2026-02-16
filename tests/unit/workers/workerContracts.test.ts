import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledPost: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    publishedItem: {
      findUnique: jest.fn(),
    },
    performanceSnapshot: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/security/tokenCrypto", () => ({
  decryptToken: jest.fn(() => "token"),
  TokenCryptoError: class TokenCryptoError extends Error {
    code = "DECRYPT_FAILED";
  },
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueMetricsFetchJob: jest.fn().mockResolvedValue({ id: "job_metrics_1" }),
}));

jest.mock("@/lib/reddit/client", () => ({
  redditFetch: jest.fn(),
  enforceRedditAccountRateLimit: jest.fn(),
}));

jest.mock("@/lib/locks/distributed", () => ({
  acquireDistributedLock: jest.fn(),
}));

import { processPublishJob } from "@/workers/publish.worker";
import { processMetricsFetchJob } from "@/workers/metrics.worker";
import { prisma } from "@/lib/prisma";
import { enqueueMetricsFetchJob } from "@/lib/queue/enqueue";
import { redditFetch } from "@/lib/reddit/client";
import { acquireDistributedLock } from "@/lib/locks/distributed";

const mockedPrisma = prisma as unknown as {
  scheduledPost: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  publishedItem: {
    findUnique: jest.Mock;
  };
  performanceSnapshot: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("worker contracts", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (acquireDistributedLock as jest.Mock)
      .mockResolvedValueOnce({
        acquired: true,
        release: jest.fn().mockResolvedValue(undefined),
      })
      .mockResolvedValue({
        acquired: true,
        release: jest.fn().mockResolvedValue(undefined),
      });
  });

  test("publish worker writes published item and schedules metrics fetch", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      id: "sp_1",
      workspaceId: "ws_1",
      status: "SCHEDULED",
      attempts: 0,
      draft: {
        id: "d_1",
        type: "POST",
        title: "Title",
        body: "Body",
        status: "APPROVED",
      },
      subreddit: { id: "sub_1", name: "startups" },
      redditAccount: { id: "ra_1", accessToken: "enc", isActive: true },
    });
    mockedPrisma.scheduledPost.update.mockResolvedValue({});
    mockedPrisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        publishedItem: { create: jest.fn().mockResolvedValue({ id: "pi_1" }) },
        scheduledPost: { update: jest.fn().mockResolvedValue({}) },
      }),
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        json: {
          errors: [],
          data: {
            id: "abc123",
            name: "t3_abc123",
            url: "https://reddit.com/r/startups/comments/abc123/post",
          },
        },
      }),
    }) as unknown as typeof fetch;

    const job = {
      data: { scheduledPostId: "sp_1" },
    } as unknown as Job<{ scheduledPostId: string }>;
    const out = await processPublishJob(job);

    expect(out).toEqual({
      scheduledPostId: "sp_1",
      publishedItemId: "pi_1",
      status: "published",
    });
    expect(mockedPrisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHING" }),
      }),
    );
    expect(enqueueMetricsFetchJob).toHaveBeenCalledWith({
      publishedItemId: "pi_1",
    });
  });

  test("metrics worker writes performance snapshot", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue({
      id: "pi_1",
      redditFullname: "t3_abc",
      redditAccount: { id: "ra_1", accessToken: "enc" },
    });
    (redditFetch as jest.Mock).mockResolvedValue({
      data: {
        data: {
          children: [
            {
              data: {
                score: 9,
                ups: 10,
                downs: 1,
                upvote_ratio: 0.9,
                num_comments: 3,
                removed: false,
                removed_by_category: null,
                locked: false,
                stickied: false,
              },
            },
          ],
        },
      },
    });
    mockedPrisma.performanceSnapshot.create.mockResolvedValue({});

    const job = {
      data: { publishedItemId: "pi_1" },
    } as unknown as Job<{ publishedItemId: string }>;
    const out = await processMetricsFetchJob(job);

    expect(out).toEqual({ publishedItemId: "pi_1", status: "captured" });
    expect(mockedPrisma.performanceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedItemId: "pi_1",
          score: 9,
          numComments: 3,
        }),
      }),
    );
  });

  test("publish worker fails permanently when draft is not approved", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      id: "sp_2",
      workspaceId: "ws_1",
      status: "SCHEDULED",
      attempts: 0,
      draft: {
        id: "d_2",
        type: "POST",
        title: "Title",
        body: "Body",
        status: "DRAFT",
      },
      subreddit: { id: "sub_1", name: "startups" },
      redditAccount: { id: "ra_1", accessToken: "enc", isActive: true },
    });
    mockedPrisma.scheduledPost.update.mockResolvedValue({});

    const job = {
      data: { scheduledPostId: "sp_2" },
    } as unknown as Job<{ scheduledPostId: string }>;
    await expect(processPublishJob(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(mockedPrisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED_PERMANENT",
          lastError: "DRAFT_NOT_APPROVED",
        }),
      }),
    );
  });

  test("publish worker marks retryable failure on transient submit error", async () => {
    mockedPrisma.scheduledPost.findUnique.mockResolvedValue({
      id: "sp_3",
      workspaceId: "ws_1",
      status: "SCHEDULED",
      attempts: 0,
      draft: {
        id: "d_3",
        type: "POST",
        title: "Title",
        body: "Body",
        status: "APPROVED",
      },
      subreddit: { id: "sub_1", name: "startups" },
      redditAccount: { id: "ra_1", accessToken: "enc", isActive: true },
    });
    mockedPrisma.scheduledPost.update.mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const job = {
      data: { scheduledPostId: "sp_3" },
    } as unknown as Job<{ scheduledPostId: string }>;
    await expect(processPublishJob(job)).rejects.toBeInstanceOf(Error);
    expect(mockedPrisma.scheduledPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED_RETRYABLE" }),
      }),
    );
  });

  test("metrics worker errors unrecoverably when item is missing", async () => {
    mockedPrisma.publishedItem.findUnique.mockResolvedValue(null);

    const job = {
      data: { publishedItemId: "missing" },
    } as unknown as Job<{ publishedItemId: string }>;
    await expect(processMetricsFetchJob(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
