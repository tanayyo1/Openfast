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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeFixture(draftStatus: "APPROVED" | "DRAFT") {
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
        safetyTier: "ESTABLISHED",
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
        type: "POST",
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
    await prisma.draft.deleteMany({ where: { id: ids.draftId } });
    await prisma.project.deleteMany({ where: { id: ids.projectId } });
    await prisma.redditAccount.deleteMany({
      where: { id: ids.redditAccountId },
    });
    await prisma.subredditCatalog.deleteMany({
      where: { id: ids.subredditId },
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
      };
      expect(created.scheduledPost.status).toBe("SCHEDULED");

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

  test("supports idempotent create by idempotency key", async () => {
    const ids = await makeFixture("APPROVED");
    const idempotencyKey = `sched_test_${Date.now()}_${counter}`;
    try {
      const req = new Request("http://test.local/api/scheduled-posts", {
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
      const first = await createScheduledPost(req);
      expect(first.status).toBe(201);
      const second = await createScheduledPost(req);
      expect(second.status).toBe(200);
      const json = (await readJson(second)) as { idempotent: boolean };
      expect(json.idempotent).toBe(true);
    } finally {
      await cleanupFixture(ids);
    }
  });
});
