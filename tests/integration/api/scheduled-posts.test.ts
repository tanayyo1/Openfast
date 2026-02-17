import { Prisma, PrismaClient } from "@prisma/client";
import {
  GET as listScheduledPosts,
  POST as createScheduledPost,
} from "@/app/api/scheduled-posts/route";
import {
  DELETE as deleteScheduledPost,
  PATCH as patchScheduledPost,
} from "@/app/api/scheduled-posts/[id]/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueuePublishJob: jest.fn().mockResolvedValue({ id: "job_publish_1" }),
}));

const prisma = new PrismaClient();
const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Scheduled posts API", () => {
  let workspaceId: string;
  let userId: string;
  let counter = 0;
  const originalCommunityThreshold =
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) throw new Error("Seed user missing. Ensure prisma db seed ran.");

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws)
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");

    userId = user.id;
    workspaceId = ws.workspaceId;
  });

  beforeEach(() => {
    mockedGuards.requireWorkspaceSession.mockReset();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "0";
  });

  afterEach(() => {
    if (typeof originalCommunityThreshold === "string") {
      process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = originalCommunityThreshold;
      return;
    }
    delete process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeFixture(
    draftStatus: "APPROVED" | "DRAFT",
    opts?: {
      safetyTier?: "NEW" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED";
      draftType?: "POST" | "COMMENT";
    },
  ) {
    counter += 1;
    const suffix = `${Date.now()}_${counter}`;

    const subreddit = await prisma.subredditCatalog.create({
      data: {
        name: `schedsub_${suffix}`,
        title: `Sched Sub ${suffix}`,
        description: "Test subreddit",
        lastFetchedAt: new Date(),
      },
      select: { id: true },
    });

    const redditAccount = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: `sched_user_${suffix}`,
        redditUserId: `t2_${suffix}`,
        accessToken: "enc_access",
        refreshToken: "enc_refresh",
        tokenExpiry: new Date(Date.now() + 3_600_000),
        scopes: ["identity", "read", "submit"],
        linkKarma: 100,
        commentKarma: 100,
        accountAge: 365,
        safetyTier: opts?.safetyTier ?? "ESTABLISHED",
        lastSyncAt: new Date(),
        isActive: true,
      },
      select: { id: true },
    });

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: `Scheduled Project ${suffix}`,
        description: "Test project",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    const draft = await prisma.draft.create({
      data: {
        workspaceId,
        projectId: project.id,
        subredditId: subreddit.id,
        type: opts?.draftType ?? "POST",
        title: "Approved draft",
        body: "Body",
        mediaUrls: [],
        variants: Prisma.DbNull,
        generationParams: Prisma.DbNull,
        status: draftStatus,
        riskScore: 0,
        riskReasons: [],
        suggestedFixes: Prisma.DbNull,
        approvedAt: draftStatus === "APPROVED" ? new Date() : null,
        approvedBy: draftStatus === "APPROVED" ? userId : null,
      },
      select: { id: true },
    });

    return {
      subredditId: subreddit.id,
      redditAccountId: redditAccount.id,
      projectId: project.id,
      draftId: draft.id,
    };
  }

  async function cleanupFixture(ids: {
    subredditId: string;
    redditAccountId: string;
    projectId: string;
    draftId: string;
  }) {
    await prisma.scheduledPost.deleteMany({ where: { draftId: ids.draftId } });
    await prisma.publishedItem.deleteMany({
      where: {
        redditAccountId: ids.redditAccountId,
        subredditId: ids.subredditId,
      },
    });
    await prisma.draft.deleteMany({ where: { id: ids.draftId } });
    await prisma.project.deleteMany({ where: { id: ids.projectId } });
    await prisma.redditAccount.deleteMany({
      where: { id: ids.redditAccountId },
    });
    await prisma.subredditCatalog.deleteMany({
      where: { id: ids.subredditId },
    });
  }

  async function createPublishedComment(input: {
    workspaceId: string;
    redditAccountId: string;
    subredditId: string;
    uniqueKey: string;
  }) {
    return prisma.publishedItem.create({
      data: {
        workspaceId: input.workspaceId,
        redditAccountId: input.redditAccountId,
        subredditId: input.subredditId,
        type: "COMMENT",
        redditFullname: `t1_${input.uniqueKey}`,
        redditId: input.uniqueKey,
        permalink: `/r/test/comments/${input.uniqueKey}`,
        url: `https://reddit.com/r/test/comments/${input.uniqueKey}`,
        titleSnapshot: null,
        bodySnapshot: "seed comment",
      },
      select: { id: true },
    });
  }

  test("create -> list -> cancel -> delete lifecycle", async () => {
    const ids = await makeFixture("APPROVED");
    try {
      const createRes = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(createRes.status).toBe(201);
      const created = (await readJson(createRes)) as {
        scheduledPost: { id: string; status: string };
        structure: {
          grade: string;
          score: number;
          warnings: unknown[];
          rewriteSuggestions: unknown[];
        };
      };
      expect(created.scheduledPost.status).toBe("SCHEDULED");
      expect(created.structure).toBeDefined();
      expect(created.structure.grade).toMatch(/^[A-F]$/);
      expect(typeof created.structure.score).toBe("number");
      expect(Array.isArray(created.structure.warnings)).toBe(true);
      expect(Array.isArray(created.structure.rewriteSuggestions)).toBe(true);

      const listRes = await listScheduledPosts(
        new Request(
          `http://test.local/api/scheduled-posts?projectId=${ids.projectId}&status=SCHEDULED`,
        ),
      );
      expect(listRes.status).toBe(200);
      const listJson = (await readJson(listRes)) as {
        items: Array<{ id: string }>;
      };
      expect(
        listJson.items.some((i) => i.id === created.scheduledPost.id),
      ).toBe(true);

      const cancelRes = await patchScheduledPost(
        new Request(
          `http://test.local/api/scheduled-posts/${created.scheduledPost.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel" }),
          },
        ),
        { params: { id: created.scheduledPost.id } },
      );
      expect(cancelRes.status).toBe(200);

      const deletedRes = await deleteScheduledPost(
        new Request(
          `http://test.local/api/scheduled-posts/${created.scheduledPost.id}`,
          { method: "DELETE" },
        ),
        { params: { id: created.scheduledPost.id } },
      );
      expect(deletedRes.status).toBe(200);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("enforces approved draft only", async () => {
    const ids = await makeFixture("DRAFT");
    try {
      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(409);
      const json = (await readJson(res)) as { code: string };
      expect(json.code).toBe("INVALID_STATE");
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("enforces comment-first mode for NEW accounts scheduling POST drafts", async () => {
    const ids = await makeFixture("APPROVED", {
      safetyTier: "NEW",
      draftType: "POST",
    });
    try {
      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(409);
      const json = (await readJson(res)) as {
        code: string;
        details: { requiredComments: number; publishedComments: number };
      };
      expect(json.code).toBe("COMMENT_FIRST_REQUIRED");
      expect(json.details.requiredComments).toBe(3);
      expect(json.details.publishedComments).toBe(0);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("blocks post scheduling when account health score is critically low", async () => {
    const ids = await makeFixture("APPROVED", {
      safetyTier: "ESTABLISHED",
      draftType: "POST",
    });
    try {
      await prisma.accountHealthSnapshot.create({
        data: {
          workspaceId,
          redditAccountId: ids.redditAccountId,
          healthScore: 22,
          signalsJson: { sampleSize: 12, removals: 6, removalRate: 0.5 },
          capturedAt: new Date(),
        },
      });

      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(409);
      const json = (await readJson(res)) as {
        code: string;
        details: { healthScore: number; threshold: number };
      };
      expect(json.code).toBe("ACCOUNT_HEALTH_BLOCKED");
      expect(json.details.healthScore).toBe(22);
      expect(json.details.threshold).toBe(30);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("enforces community engagement threshold before scheduling POST drafts", async () => {
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "2";
    const ids = await makeFixture("APPROVED", {
      safetyTier: "ESTABLISHED",
      draftType: "POST",
    });
    try {
      const blocked = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(blocked.status).toBe(409);
      const blockedJson = (await readJson(blocked)) as {
        code: string;
        details: {
          requiredComments: number;
          publishedComments: number;
          remainingComments: number;
        };
      };
      expect(blockedJson.code).toBe("COMMUNITY_ENGAGEMENT_REQUIRED");
      expect(blockedJson.details.requiredComments).toBe(2);
      expect(blockedJson.details.publishedComments).toBe(0);
      expect(blockedJson.details.remainingComments).toBe(2);

      await createPublishedComment({
        workspaceId,
        redditAccountId: ids.redditAccountId,
        subredditId: ids.subredditId,
        uniqueKey: `c1_${Date.now()}_${counter}`,
      });
      await createPublishedComment({
        workspaceId,
        redditAccountId: ids.redditAccountId,
        subredditId: ids.subredditId,
        uniqueKey: `c2_${Date.now()}_${counter}`,
      });

      const allowed = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(allowed.status).toBe(201);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("does not enforce community engagement threshold for COMMENT drafts", async () => {
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "2";
    const ids = await makeFixture("APPROVED", {
      safetyTier: "ESTABLISHED",
      draftType: "COMMENT",
    });
    try {
      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(201);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("rejects duplicate scheduling for the same draft", async () => {
    const ids = await makeFixture("APPROVED");
    const idempotencyKey = `sched_test_${Date.now()}_${counter}`;
    try {
      const makeRequest = () =>
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            timezone: "UTC",
            idempotencyKey,
          }),
        });

      const first = await createScheduledPost(makeRequest());
      expect(first.status).toBe(201);
      const second = await createScheduledPost(makeRequest());
      expect(second.status).toBe(409);
      const json = (await readJson(second)) as { code: string };
      expect(json.code).toBe("ALREADY_SCHEDULED");
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("rejects scheduling with past scheduledAt", async () => {
    const ids = await makeFixture("APPROVED");
    try {
      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: ids.draftId,
            redditAccountId: ids.redditAccountId,
            scheduledAt: new Date(Date.now() - 30_000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(400);
      const json = (await readJson(res)) as { code: string };
      expect(json.code).toBe("INVALID_SCHEDULED_AT");
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("cancel rejects invalid action", async () => {
    const ids = await makeFixture("APPROVED");
    let scheduledId = "";
    try {
      const created = await prisma.scheduledPost.create({
        data: {
          workspaceId,
          draftId: ids.draftId,
          redditAccountId: ids.redditAccountId,
          subredditId: ids.subredditId,
          scheduledAt: new Date(Date.now() + 5 * 60_000),
          timezone: "UTC",
          status: "SCHEDULED",
          idempotencyKey: `sched_invalid_action_${Date.now()}_${counter}`,
        },
        select: { id: true },
      });
      scheduledId = created.id;

      const res = await patchScheduledPost(
        new Request(`http://test.local/api/scheduled-posts/${scheduledId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "noop" }),
        }),
        { params: { id: scheduledId } },
      );
      expect(res.status).toBe(400);
      const json = (await readJson(res)) as { code: string };
      expect(json.code).toBe("VALIDATION_ERROR");
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("cancel/delete reject invalid state transitions", async () => {
    const ids = await makeFixture("APPROVED");
    let publishingId = "";
    let publishedId = "";
    let extraDraftId = "";
    try {
      const publishing = await prisma.scheduledPost.create({
        data: {
          workspaceId,
          draftId: ids.draftId,
          redditAccountId: ids.redditAccountId,
          subredditId: ids.subredditId,
          scheduledAt: new Date(Date.now() + 5 * 60_000),
          timezone: "UTC",
          status: "PUBLISHING",
          idempotencyKey: `sched_publishing_${Date.now()}_${counter}`,
        },
        select: { id: true },
      });
      publishingId = publishing.id;

      const cancelRes = await patchScheduledPost(
        new Request(`http://test.local/api/scheduled-posts/${publishingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        }),
        { params: { id: publishingId } },
      );
      expect(cancelRes.status).toBe(409);
      const cancelJson = (await readJson(cancelRes)) as { code: string };
      expect(cancelJson.code).toBe("INVALID_STATE");

      const extraDraft = await prisma.draft.create({
        data: {
          workspaceId,
          projectId: ids.projectId,
          subredditId: ids.subredditId,
          type: "POST",
          title: "Extra approved draft",
          body: "Body",
          mediaUrls: [],
          variants: Prisma.DbNull,
          generationParams: Prisma.DbNull,
          status: "APPROVED",
          riskScore: 0,
          riskReasons: [],
          suggestedFixes: Prisma.DbNull,
          approvedAt: new Date(),
          approvedBy: userId,
        },
        select: { id: true },
      });
      extraDraftId = extraDraft.id;

      const published = await prisma.scheduledPost.create({
        data: {
          workspaceId,
          draftId: extraDraft.id,
          redditAccountId: ids.redditAccountId,
          subredditId: ids.subredditId,
          scheduledAt: new Date(Date.now() + 5 * 60_000),
          timezone: "UTC",
          status: "PUBLISHED",
          idempotencyKey: `sched_published_${Date.now()}_${counter}`,
        },
        select: { id: true },
      });
      publishedId = published.id;

      const deleteRes = await deleteScheduledPost(
        new Request(`http://test.local/api/scheduled-posts/${publishedId}`, {
          method: "DELETE",
        }),
        { params: { id: publishedId } },
      );
      expect(deleteRes.status).toBe(409);
      const deleteJson = (await readJson(deleteRes)) as { code: string };
      expect(deleteJson.code).toBe("INVALID_STATE");
    } finally {
      if (publishingId) {
        await prisma.scheduledPost.deleteMany({ where: { id: publishingId } });
      }
      if (publishedId) {
        await prisma.scheduledPost.deleteMany({ where: { id: publishedId } });
      }
      if (extraDraftId) {
        await prisma.draft.deleteMany({ where: { id: extraDraftId } });
      }
      await cleanupFixture(ids);
    }
  });

  test("returns unauthorized when session is missing", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );
    const res = await listScheduledPosts(
      new Request("http://test.local/api/scheduled-posts"),
    );
    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });
});
