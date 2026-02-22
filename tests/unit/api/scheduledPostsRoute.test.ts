jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  QuotaExceededError: class extends Error {
    code = "QUOTA_EXCEEDED";
    resource = "scheduled_posts";
    limit = 0;
    used = 0;
  },
  assertWorkspaceQuota: jest.fn(),
}));

jest.mock("@/lib/health/guardrails", () => ({
  getHealthGuardrailThresholds: jest.fn(() => ({
    caution: 40,
    blockPublishing: 30,
  })),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueuePublishJob: jest.fn(),
}));

jest.mock("@/lib/reddit/communityEngagement", () => ({
  evaluateCommunityEngagementThreshold: jest.fn(),
}));

jest.mock("@/lib/content/postStructureValidator", () => ({
  validatePostStructure: jest.fn(() => ({
    score: 1,
    grade: "A",
    warnings: [],
    rewriteSuggestions: [],
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledPost: { findMany: jest.fn() },
  },
}));

import { GET as listScheduledPosts } from "@/app/api/scheduled-posts/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  scheduledPost: { findMany: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function scheduledPostItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp_1",
    draftId: "draft_1",
    redditAccountId: "acc_1",
    subredditId: "sub_1",
    scheduledAt: new Date("2026-02-23T10:00:00.000Z"),
    timezone: "UTC",
    status: "SCHEDULED",
    attempts: 0,
    lastError: null,
    idempotencyKey: "idem_key_1",
    publishedAt: null,
    publishedItemId: null,
    createdAt: new Date("2026-02-22T10:00:00.000Z"),
    updatedAt: new Date("2026-02-22T10:00:00.000Z"),
    draft: {
      id: "draft_1",
      projectId: "project_1",
      type: "POST",
      title: "Draft",
      status: "APPROVED",
    },
    redditAccount: {
      id: "acc_1",
      redditUsername: "user_1",
      safetyTier: "ESTABLISHED",
      isActive: true,
    },
    subreddit: {
      id: "sub_1",
      name: "startups",
      title: "Startups",
    },
    ...overrides,
  };
}

describe("scheduled posts route list query", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("returns 401 when auth guard fails", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await listScheduledPosts(
      new Request("http://test.local/api/scheduled-posts"),
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
    expect(mockedPrisma.scheduledPost.findMany).not.toHaveBeenCalled();
  });

  test("honors draftIds filter and expands effective limit to include all ids", async () => {
    mockedPrisma.scheduledPost.findMany.mockResolvedValueOnce([
      scheduledPostItem({ id: "sp_1", draftId: "draft_1" }),
      scheduledPostItem({ id: "sp_2", draftId: "draft_2" }),
    ]);

    const res = await listScheduledPosts(
      new Request(
        "http://test.local/api/scheduled-posts?limit=1&draftIds=draft_1,draft_2",
      ),
    );

    expect(res.status).toBe(200);
    expect(mockedPrisma.scheduledPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "ws_1",
          draftId: { in: ["draft_1", "draft_2"] },
        }),
        take: 3,
      }),
    );
    const json = (await readJson(res)) as {
      hasMore: boolean;
      items: Array<{ draftId: string }>;
      limit: number;
    };
    expect(json.limit).toBe(2);
    expect(json.hasMore).toBe(false);
    expect(json.items.map((item) => item.draftId)).toEqual([
      "draft_1",
      "draft_2",
    ]);
  });

  test("sets hasMore when records exceed requested limit", async () => {
    mockedPrisma.scheduledPost.findMany.mockResolvedValueOnce([
      scheduledPostItem({ id: "sp_1" }),
      scheduledPostItem({ id: "sp_2", draftId: "draft_2" }),
    ]);

    const res = await listScheduledPosts(
      new Request("http://test.local/api/scheduled-posts?limit=1"),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      hasMore: boolean;
      items: Array<{ id: string }>;
      scheduledPosts: Array<{ id: string }>;
      limit: number;
    };
    expect(json.limit).toBe(1);
    expect(json.hasMore).toBe(true);
    expect(json.items).toHaveLength(1);
    expect(json.scheduledPosts).toHaveLength(1);
    expect(json.items[0]?.id).toBe("sp_1");
  });

  test("rejects invalid draftIds query with oversized id", async () => {
    const oversizedId = "x".repeat(129);

    const res = await listScheduledPosts(
      new Request(
        `http://test.local/api/scheduled-posts?draftIds=${oversizedId}`,
      ),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(mockedPrisma.scheduledPost.findMany).not.toHaveBeenCalled();
  });
});
