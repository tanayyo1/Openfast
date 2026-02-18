/**
 * Integration Smoke Test – Full MVP User Journey (DB-backed)
 *
 * Simulates the complete user flow through route handlers with a real database.
 * Steps that depend on external services (Reddit OAuth, AI generation, publish
 * worker) are simulated via direct DB writes; auth guards and queue enqueue
 * calls are mocked.
 *
 * Covers: create project → connect Reddit → generate roadmap → create draft
 *   → approve → schedule → publish → view analytics → health check
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { POST as createProject } from "@/app/api/projects/route";
import { POST as createDraft } from "@/app/api/drafts/route";
import { POST as requestApproval } from "@/app/api/drafts/[id]/request-approval/route";
import { POST as approveDraft } from "@/app/api/drafts/[id]/approve/route";
import {
  GET as listScheduledPosts,
  POST as createScheduledPost,
} from "@/app/api/scheduled-posts/route";
import { GET as getDashboardAnalytics } from "@/app/api/analytics/dashboard/route";
import { GET as getProjectAnalytics } from "@/app/api/analytics/projects/[id]/route";
import { GET as getAccountAnalytics } from "@/app/api/analytics/accounts/[id]/route";
import { GET as getAccountHealth } from "@/app/api/reddit/accounts/[id]/health/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
  requireSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueuePublishJob: jest.fn().mockResolvedValue({ id: "job_e2e_1" }),
  enqueueRiskAccountHealthJob: jest
    .fn()
    .mockResolvedValue({ id: "job_e2e_health_1" }),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn().mockResolvedValue({
    limit: 10,
    remaining: 9,
    resetAfterSeconds: 60,
  }),
}));

const prisma = new PrismaClient();
const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
  requireSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Integration smoke: full MVP user journey (DB-backed)", () => {
  let workspaceId: string;
  let userId: string;
  const suffix = `e2e_${Date.now()}`;

  // IDs accumulated through the journey for cleanup
  const cleanup: {
    projectId?: string;
    subredditId?: string;
    redditAccountId?: string;
    roadmapId?: string;
    taskId?: string;
    draftId?: string;
    scheduledPostId?: string;
    publishedItemId?: string;
  } = {};

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

    // Ensure generous entitlements for the test
    await prisma.workspaceEntitlement.upsert({
      where: { workspaceId },
      update: {
        maxProjects: 100,
        maxRedditAccounts: 50,
        maxScheduledPosts: 500,
        maxDraftsPerMonth: 5000,
        roadmapDays: 30,
        hasAdvancedAnalytics: true,
        hasSmartFinder: true,
        hasTeamFeatures: false,
      },
      create: {
        workspaceId,
        maxProjects: 100,
        maxRedditAccounts: 50,
        maxScheduledPosts: 500,
        maxDraftsPerMonth: 5000,
        roadmapDays: 30,
        hasAdvancedAnalytics: true,
        hasSmartFinder: true,
        hasTeamFeatures: false,
      },
    });

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
    mockedGuards.requireSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (cleanup.publishedItemId) {
      await prisma.performanceSnapshot
        .deleteMany({ where: { publishedItemId: cleanup.publishedItemId } })
        .catch(() => undefined);
      await prisma.publishedItem
        .deleteMany({ where: { id: cleanup.publishedItemId } })
        .catch(() => undefined);
    }
    if (cleanup.scheduledPostId) {
      await prisma.scheduledPost
        .deleteMany({ where: { id: cleanup.scheduledPostId } })
        .catch(() => undefined);
    }
    if (cleanup.draftId) {
      await prisma.draft
        .deleteMany({ where: { id: cleanup.draftId } })
        .catch(() => undefined);
    }
    if (cleanup.taskId) {
      await prisma.roadmapTask
        .deleteMany({ where: { id: cleanup.taskId } })
        .catch(() => undefined);
    }
    if (cleanup.roadmapId) {
      await prisma.roadmap
        .deleteMany({ where: { id: cleanup.roadmapId } })
        .catch(() => undefined);
    }
    if (cleanup.redditAccountId) {
      await prisma.accountHealthSnapshot
        .deleteMany({ where: { redditAccountId: cleanup.redditAccountId } })
        .catch(() => undefined);
      await prisma.redditAccount
        .deleteMany({ where: { id: cleanup.redditAccountId } })
        .catch(() => undefined);
    }
    if (cleanup.projectId) {
      await prisma.project
        .deleteMany({ where: { id: cleanup.projectId } })
        .catch(() => undefined);
    }
    if (cleanup.subredditId) {
      await prisma.subredditCatalog
        .deleteMany({ where: { id: cleanup.subredditId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------
  // Step 1: Create project
  // ---------------------------------------------------------------
  test("1. create project", async () => {
    const res = await createProject(
      new Request("http://test.local/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `E2E Project ${suffix}`,
          description: "End-to-end smoke test project",
          niche: "saas",
          goals: {
            primary: "traffic",
            targets: ["sign-ups"],
            kpis: ["page-views"],
          },
          brandVoice: {
            tone: "helpful",
            do: ["share insights"],
            dont: ["hard sell"],
          },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await readJson(res)) as { project: { id: string } };
    expect(json.project.id).toBeDefined();
    cleanup.projectId = json.project.id;
  });

  // ---------------------------------------------------------------
  // Step 2: Connect Reddit account (simulated via direct DB insert)
  // ---------------------------------------------------------------
  test("2. connect Reddit account", async () => {
    const subreddit = await prisma.subredditCatalog.create({
      data: {
        name: `e2esub_${suffix}`,
        title: `E2E Subreddit ${suffix}`,
        description: "Test subreddit for E2E",
        lastFetchedAt: new Date(),
      },
    });
    cleanup.subredditId = subreddit.id;

    const account = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: `e2e_user_${suffix}`,
        redditUserId: `t2_e2e_${suffix}`,
        accessToken: "enc_e2e_access",
        refreshToken: "enc_e2e_refresh",
        tokenExpiry: new Date(Date.now() + 3_600_000),
        scopes: ["identity", "read", "submit"],
        linkKarma: 500,
        commentKarma: 500,
        accountAge: 365,
        safetyTier: "ESTABLISHED",
        lastSyncAt: new Date(),
        isActive: true,
      },
    });
    cleanup.redditAccountId = account.id;

    // Create a health snapshot so health endpoint works
    await prisma.accountHealthSnapshot.create({
      data: {
        workspaceId,
        redditAccountId: account.id,
        healthScore: 80,
        signalsJson: {
          linkKarma: 500,
          commentKarma: 500,
          accountAgeDays: 365,
          isSuspended: false,
          isShadowbanned: false,
        },
      },
    });

    expect(account.id).toBeDefined();
  });

  // ---------------------------------------------------------------
  // Step 3: Generate roadmap + task (simulated via DB)
  // ---------------------------------------------------------------
  test("3. generate roadmap with task", async () => {
    const roadmap = await prisma.roadmap.create({
      data: {
        workspaceId,
        projectId: cleanup.projectId!,
        startDate: new Date(),
        horizonDays: 7,
        version: 1,
        status: "ACTIVE",
        strategy: { approach: "value-first" },
      },
    });
    cleanup.roadmapId = roadmap.id;

    const task = await prisma.roadmapTask.create({
      data: {
        workspaceId,
        roadmapId: roadmap.id,
        dayIndex: 1,
        type: "POST",
        title: "Share a SaaS growth tip",
        instructions: "Write a helpful post about SaaS growth tactics",
        priority: 1,
        status: "PENDING",
      },
    });
    cleanup.taskId = task.id;

    expect(roadmap.id).toBeDefined();
    expect(task.id).toBeDefined();
  });

  // ---------------------------------------------------------------
  // Step 4: Create draft with variants
  // ---------------------------------------------------------------
  test("4. create draft with variants", async () => {
    const res = await createDraft(
      new Request("http://test.local/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: cleanup.projectId,
          taskId: cleanup.taskId,
          subredditId: cleanup.subredditId,
          type: "POST",
          title: "3 SaaS growth lessons from bootstrapping to $10k MRR",
          body: "After 18 months of grinding, here are the three biggest lessons I learned growing a SaaS product from zero to $10k MRR. First, focus on retention over acquisition. Second, talk to your users weekly. Third, solve one problem really well before expanding.",
          variants: [
            {
              title: "What I learned growing a SaaS to $10k MRR",
              body: "Key lessons from 18 months bootstrapping a SaaS product. Retention matters more than acquisition. User conversations reveal gold. Focus beats feature bloat.",
              score: 0.8,
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await readJson(res)) as {
      draft: { id: string; status: string };
    };
    expect(json.draft.status).toBe("DRAFT");
    cleanup.draftId = json.draft.id;
  });

  // ---------------------------------------------------------------
  // Step 5: Approve draft (request → approve)
  // ---------------------------------------------------------------
  test("5. approve draft", async () => {
    const reqRes = await requestApproval(
      new Request(
        `http://test.local/api/drafts/${cleanup.draftId}/request-approval`,
        { method: "POST" },
      ),
      { params: { id: cleanup.draftId! } },
    );
    expect(reqRes.status).toBe(200);
    const reqJson = (await readJson(reqRes)) as {
      draft: { status: string };
    };
    expect(reqJson.draft.status).toBe("REVIEWING");

    const approveRes = await approveDraft(
      new Request(`http://test.local/api/drafts/${cleanup.draftId}/approve`, {
        method: "POST",
      }),
      { params: { id: cleanup.draftId! } },
    );
    expect(approveRes.status).toBe(200);
    const approveJson = (await readJson(approveRes)) as {
      draft: { status: string; approvedBy: string };
    };
    expect(approveJson.draft.status).toBe("APPROVED");
    expect(approveJson.draft.approvedBy).toBe(userId);
  });

  // ---------------------------------------------------------------
  // Step 6: Schedule post
  // ---------------------------------------------------------------
  test("6. schedule approved draft", async () => {
    // Disable community engagement threshold for test
    const original = process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;
    process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "0";

    try {
      const res = await createScheduledPost(
        new Request("http://test.local/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: cleanup.draftId,
            redditAccountId: cleanup.redditAccountId,
            subredditId: cleanup.subredditId,
            scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            timezone: "UTC",
          }),
        }),
      );
      expect(res.status).toBe(201);
      const json = (await readJson(res)) as {
        scheduledPost: { id: string; status: string };
      };
      expect(json.scheduledPost.status).toBe("SCHEDULED");
      cleanup.scheduledPostId = json.scheduledPost.id;
    } finally {
      if (typeof original === "string") {
        process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = original;
      } else {
        delete process.env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;
      }
    }
  });

  // ---------------------------------------------------------------
  // Step 7: Simulate publish (worker output via DB)
  // ---------------------------------------------------------------
  test("7. simulate publish result", async () => {
    // Mark scheduled post as published
    await prisma.scheduledPost.update({
      where: { id: cleanup.scheduledPostId! },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    const publishedItem = await prisma.publishedItem.create({
      data: {
        workspaceId,
        redditAccountId: cleanup.redditAccountId!,
        subredditId: cleanup.subredditId!,
        scheduledPostId: cleanup.scheduledPostId!,
        type: "POST",
        redditFullname: `t3_e2e_${suffix}`,
        redditId: `e2e_${suffix}`,
        permalink: `/r/e2esub/comments/e2e_${suffix}`,
        url: `https://reddit.com/r/e2esub/comments/e2e_${suffix}`,
        titleSnapshot: "3 SaaS growth lessons from bootstrapping to $10k MRR",
        bodySnapshot: "After 18 months of grinding...",
      },
    });
    cleanup.publishedItemId = publishedItem.id;

    // Simulate metrics fetch
    await prisma.performanceSnapshot.create({
      data: {
        publishedItemId: publishedItem.id,
        score: 42,
        upvotes: 45,
        downvotes: 3,
        upvoteRatio: 0.93,
        numComments: 12,
        isRemoved: false,
        removalReason: null,
        isLocked: false,
        isStickied: false,
        rawData: Prisma.DbNull,
        capturedAt: new Date(),
      },
    });

    expect(publishedItem.id).toBeDefined();
  });

  // ---------------------------------------------------------------
  // Step 8: View analytics
  // ---------------------------------------------------------------
  test("8. view analytics (dashboard + project + account)", async () => {
    // Dashboard
    const dashRes = await getDashboardAnalytics();
    expect(dashRes.status).toBe(200);
    const dashJson = (await readJson(dashRes)) as {
      summary: { publishedCount: number; totalScore: number };
    };
    expect(dashJson.summary.publishedCount).toBeGreaterThanOrEqual(1);
    expect(dashJson.summary.totalScore).toBeGreaterThanOrEqual(42);

    // Project analytics
    const projRes = await getProjectAnalytics(
      new Request(
        `http://test.local/api/analytics/projects/${cleanup.projectId}`,
      ),
      { params: { id: cleanup.projectId! } },
    );
    expect(projRes.status).toBe(200);
    const projJson = (await readJson(projRes)) as {
      summary: { publishedCount: number; totalScore: number };
    };
    expect(projJson.summary.publishedCount).toBe(1);
    expect(projJson.summary.totalScore).toBe(42);

    // Account analytics
    const accRes = await getAccountAnalytics(
      new Request(
        `http://test.local/api/analytics/accounts/${cleanup.redditAccountId}`,
      ),
      { params: { id: cleanup.redditAccountId! } },
    );
    expect(accRes.status).toBe(200);
    const accJson = (await readJson(accRes)) as {
      summary: { publishedCount: number; totalScore: number };
    };
    expect(accJson.summary.publishedCount).toBe(1);
    expect(accJson.summary.totalScore).toBe(42);
  });

  // ---------------------------------------------------------------
  // Step 9: Risk checks (account health)
  // ---------------------------------------------------------------
  test("9. account health check returns snapshot", async () => {
    const healthRes = await getAccountHealth(
      new Request(
        `http://test.local/api/reddit/accounts/${cleanup.redditAccountId}/health`,
      ),
      { params: { id: cleanup.redditAccountId! } },
    );
    expect(healthRes.status).toBe(200);
    const healthJson = (await readJson(healthRes)) as {
      account: { safetyTier: string };
      latestSnapshot: { healthScore: number };
      guardrails: { blockPublishing: boolean };
    };
    expect(healthJson.account.safetyTier).toBe("ESTABLISHED");
    expect(healthJson.latestSnapshot.healthScore).toBe(80);
    expect(healthJson.guardrails.blockPublishing).toBe(false);
  });

  // ---------------------------------------------------------------
  // Step 10: Verify scheduled posts list
  // ---------------------------------------------------------------
  test("10. list scheduled posts shows published entry", async () => {
    const res = await listScheduledPosts(
      new Request("http://test.local/api/scheduled-posts"),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      scheduledPosts: Array<{ id: string; status: string }>;
    };
    const ours = json.scheduledPosts.find(
      (p) => p.id === cleanup.scheduledPostId,
    );
    expect(ours).toBeDefined();
    expect(ours!.status).toBe("PUBLISHED");
  });
});
