import { Prisma, PrismaClient } from "@prisma/client";
import { GET as getProjectAnalytics } from "@/app/api/analytics/projects/[id]/route";
import { GET as getAccountAnalytics } from "@/app/api/analytics/accounts/[id]/route";
import { GET as getDashboardAnalytics } from "@/app/api/analytics/dashboard/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

const prisma = new PrismaClient();
const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Analytics APIs", () => {
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

  async function makeAnalyticsFixture() {
    counter += 1;
    const suffix = `${Date.now()}_${counter}`;

    const subreddit = await prisma.subredditCatalog.create({
      data: {
        name: `analyticssub_${suffix}`,
        title: `Analytics Sub ${suffix}`,
        description: "Analytics test subreddit",
        lastFetchedAt: new Date(),
      },
      select: { id: true },
    });

    const redditAccount = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: `analytics_user_${suffix}`,
        redditUserId: `t2_${suffix}`,
        accessToken: "enc_access",
        refreshToken: "enc_refresh",
        tokenExpiry: new Date(Date.now() + 3_600_000),
        scopes: ["identity", "read", "submit"],
        linkKarma: 500,
        commentKarma: 500,
        accountAge: 365,
        safetyTier: "TRUSTED",
        lastSyncAt: new Date(),
        isActive: true,
      },
      select: { id: true },
    });

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: `Analytics Project ${suffix}`,
        description: "Project for analytics tests",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true, name: true },
    });

    const draft = await prisma.draft.create({
      data: {
        workspaceId,
        projectId: project.id,
        subredditId: subreddit.id,
        type: "POST",
        title: "Published draft",
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

    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        workspaceId,
        draftId: draft.id,
        redditAccountId: redditAccount.id,
        subredditId: subreddit.id,
        scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
        timezone: "UTC",
        status: "PUBLISHED",
        idempotencyKey: `sched_analytics_${suffix}`,
        publishedAt: new Date(Date.now() - 60_000),
      },
      select: { id: true },
    });

    const publishedItem = await prisma.publishedItem.create({
      data: {
        workspaceId,
        redditAccountId: redditAccount.id,
        subredditId: subreddit.id,
        scheduledPostId: scheduledPost.id,
        type: "POST",
        redditFullname: `t3_${suffix}`,
        redditId: `post_${suffix}`,
        permalink: `https://reddit.com/r/test/comments/${suffix}`,
        url: null,
        titleSnapshot: "Title snapshot",
        bodySnapshot: "Body snapshot",
      },
      select: { id: true },
    });

    await prisma.performanceSnapshot.createMany({
      data: [
        {
          publishedItemId: publishedItem.id,
          score: 10,
          upvotes: 11,
          downvotes: 1,
          upvoteRatio: 0.91,
          numComments: 3,
          isRemoved: false,
          removalReason: null,
          isLocked: false,
          isStickied: false,
          rawData: Prisma.DbNull,
          capturedAt: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          publishedItemId: publishedItem.id,
          score: 25,
          upvotes: 26,
          downvotes: 1,
          upvoteRatio: 0.96,
          numComments: 9,
          isRemoved: true,
          removalReason: "mod_removed",
          isLocked: false,
          isStickied: false,
          rawData: Prisma.DbNull,
          capturedAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      ],
    });

    return {
      projectId: project.id,
      draftId: draft.id,
      subredditId: subreddit.id,
      redditAccountId: redditAccount.id,
      scheduledPostId: scheduledPost.id,
      publishedItemId: publishedItem.id,
    };
  }

  async function cleanupFixture(ids: {
    projectId: string;
    draftId: string;
    subredditId: string;
    redditAccountId: string;
    scheduledPostId: string;
    publishedItemId: string;
  }) {
    await prisma.performanceSnapshot.deleteMany({
      where: { publishedItemId: ids.publishedItemId },
    });
    await prisma.publishedItem.deleteMany({
      where: { id: ids.publishedItemId },
    });
    await prisma.scheduledPost.deleteMany({
      where: { id: ids.scheduledPostId },
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

  test("project/account/dashboard analytics return scoped aggregates", async () => {
    const ids = await makeAnalyticsFixture();
    try {
      const projectRes = await getProjectAnalytics(
        new Request(
          `http://test.local/api/analytics/projects/${ids.projectId}`,
        ),
        { params: { id: ids.projectId } },
      );
      expect(projectRes.status).toBe(200);
      const projectJson = (await readJson(projectRes)) as {
        summary: {
          publishedCount: number;
          totalScore: number;
          removedCount: number;
        };
      };
      expect(projectJson.summary.publishedCount).toBe(1);
      expect(projectJson.summary.totalScore).toBe(25);
      expect(projectJson.summary.removedCount).toBe(1);

      const accountRes = await getAccountAnalytics(
        new Request(
          `http://test.local/api/analytics/accounts/${ids.redditAccountId}`,
        ),
        { params: { id: ids.redditAccountId } },
      );
      expect(accountRes.status).toBe(200);
      const accountJson = (await readJson(accountRes)) as {
        summary: { publishedCount: number; totalScore: number };
      };
      expect(accountJson.summary.publishedCount).toBe(1);
      expect(accountJson.summary.totalScore).toBe(25);

      const dashboardRes = await getDashboardAnalytics();
      expect(dashboardRes.status).toBe(200);
      const dashboardJson = (await readJson(dashboardRes)) as {
        summary: { publishedCount: number; totalScore: number };
      };
      expect(dashboardJson.summary.publishedCount).toBeGreaterThanOrEqual(1);
      expect(dashboardJson.summary.totalScore).toBeGreaterThanOrEqual(25);
    } finally {
      await cleanupFixture(ids);
    }
  });

  test("returns 404 for unknown project/account ids", async () => {
    const projectRes = await getProjectAnalytics(
      new Request("http://test.local/api/analytics/projects/missing"),
      { params: { id: "missing" } },
    );
    expect(projectRes.status).toBe(404);
    const projectJson = (await readJson(projectRes)) as { code: string };
    expect(projectJson.code).toBe("PROJECT_NOT_FOUND");

    const accountRes = await getAccountAnalytics(
      new Request("http://test.local/api/analytics/accounts/missing"),
      { params: { id: "missing" } },
    );
    expect(accountRes.status).toBe(404);
    const accountJson = (await readJson(accountRes)) as { code: string };
    expect(accountJson.code).toBe("REDDIT_ACCOUNT_NOT_FOUND");
  });

  test("returns unauthorized when session is missing", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );
    const res = await getDashboardAnalytics();
    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });
});
