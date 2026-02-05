import { Prisma, PrismaClient } from "@prisma/client";
import {
  GET as listScheduledPosts,
  POST as schedulePost,
} from "@/app/api/scheduled-posts/route";
import { POST as cancelPost } from "@/app/api/scheduled-posts/[id]/cancel/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(() => ({})),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueuePublishJob: jest.fn(),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("scheduled-posts API", () => {
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) {
      throw new Error("Seed user missing. Ensure prisma db seed ran.");
    }

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws) {
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");
    }

    userId = user.id;
    workspaceId = ws.workspaceId;

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("schedule -> list -> cancel", async () => {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Schedule Test",
        description: "desc",
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
        type: "POST",
        title: "Draft title",
        body: "Draft body",
        mediaUrls: [],
        status: "APPROVED",
        riskReasons: [],
      },
      select: { id: true },
    });

    const subreddit = await prisma.subredditCatalog.create({
      data: {
        name: "testsubreddit",
        title: "Test Subreddit",
        lastFetchedAt: new Date(),
      },
      select: { id: true },
    });

    const account = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: "testuser",
        accessToken: "enc_access",
        refreshToken: "enc_refresh",
        tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ["read"],
        accountAge: 100,
        lastSyncAt: new Date(),
      },
      select: { id: true },
    });

    const scheduledAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const scheduleReq = new Request("http://test.local/api/scheduled-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: draft.id,
        redditAccountId: account.id,
        subredditId: subreddit.id,
        scheduledAt: scheduledAtIso,
        timezone: "UTC",
      }),
    });

    const scheduledRes = await schedulePost(scheduleReq);
    expect(scheduledRes.status).toBe(201);
    const scheduledJson = (await readJson(scheduledRes)) as {
      scheduledPost: { id: string; status: string };
    };
    expect(scheduledJson.scheduledPost.id).toBeTruthy();
    expect(scheduledJson.scheduledPost.status).toBe("SCHEDULED");

    const listRes = await listScheduledPosts(
      new Request(
        `http://test.local/api/scheduled-posts?projectId=${project.id}`,
      ),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await readJson(listRes)) as {
      scheduledPosts: Array<{ id: string }>;
    };
    expect(
      listJson.scheduledPosts.some(
        (p) => p.id === scheduledJson.scheduledPost.id,
      ),
    ).toBe(true);

    const cancelRes = await cancelPost(
      new Request(
        `http://test.local/api/scheduled-posts/${scheduledJson.scheduledPost.id}/cancel`,
        { method: "POST" },
      ),
      { params: { id: scheduledJson.scheduledPost.id } },
    );
    expect(cancelRes.status).toBe(200);
    const cancelJson = (await readJson(cancelRes)) as {
      scheduledPost: { status: string };
    };
    expect(cancelJson.scheduledPost.status).toBe("CANCELLED");

    await prisma.scheduledPost.delete({
      where: { id: scheduledJson.scheduledPost.id },
    });
    await prisma.draft.delete({ where: { id: draft.id } });
    await prisma.redditAccount.delete({ where: { id: account.id } });
    await prisma.subredditCatalog.delete({ where: { id: subreddit.id } });
    await prisma.project.delete({ where: { id: project.id } });
  });

  test("list requires projectId", async () => {
    const res = await listScheduledPosts(
      new Request("http://test.local/api/scheduled-posts", { method: "GET" }),
    );
    expect(res.status).toBe(400);
  });

  test("schedule rejects invalid payload", async () => {
    const res = await schedulePost(
      new Request("http://test.local/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});
