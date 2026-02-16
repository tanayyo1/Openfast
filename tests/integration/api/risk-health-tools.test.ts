import { PrismaClient } from "@prisma/client";
import { GET as getAccountHealth } from "@/app/api/reddit/accounts/[id]/health/route";
import { POST as postVisibilityCheck } from "@/app/api/reddit/accounts/[id]/visibility-check/route";
import { POST as postGenerateTool } from "@/app/api/tools/post-generate/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
  requireSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueRiskAccountHealthJob: jest.fn(),
  enqueueRiskVisibilityCheckJob: jest.fn(),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
  requireSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueRiskAccountHealthJob: jest.Mock;
  enqueueRiskVisibilityCheckJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Risk health + tools APIs", () => {
  let workspaceId = "";
  let userId = "";
  let accountId = "";

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) throw new Error("Seed user missing. Run db seed.");

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!membership) throw new Error("Seed workspace missing. Run db seed.");

    userId = user.id;
    workspaceId = membership.workspaceId;
  });

  beforeEach(async () => {
    mockedGuards.requireWorkspaceSession.mockReset();
    mockedGuards.requireSession.mockReset();
    mockedQueue.enqueueRiskAccountHealthJob.mockReset();
    mockedQueue.enqueueRiskVisibilityCheckJob.mockReset();

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
    mockedGuards.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    mockedQueue.enqueueRiskAccountHealthJob.mockResolvedValue({
      id: "job_health_1",
    });
    mockedQueue.enqueueRiskVisibilityCheckJob.mockResolvedValue({
      id: "job_vis_1",
    });

    const created = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: `risk_test_${Date.now()}`,
        redditUserId: `ru_${Date.now()}`,
        accessToken: "rfenc.v1.mock",
        refreshToken: "rfenc.v1.mock",
        tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ["read", "submit", "identity"],
        linkKarma: 100,
        commentKarma: 200,
        accountAge: 180,
        safetyTier: "ESTABLISHED",
        lastSyncAt: new Date(),
        isActive: true,
      },
      select: { id: true },
    });
    accountId = created.id;
  });

  afterEach(async () => {
    if (accountId) {
      await prisma.redditAccount.deleteMany({
        where: { id: accountId, workspaceId },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("GET /reddit/accounts/:id/health returns guardrails and queues snapshot when missing", async () => {
    const res = await getAccountHealth(
      new Request(`http://test.local/api/reddit/accounts/${accountId}/health`),
      { params: { id: accountId } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      account: { id: string };
      latestSnapshot: unknown;
      guardrails: { blockPublishing: boolean; recommendCommentsOnly: boolean };
    };
    expect(json.account.id).toBe(accountId);
    expect(json.latestSnapshot).toBeNull();
    expect(json.guardrails.blockPublishing).toBe(false);
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledWith({
      workspaceId,
      redditAccountId: accountId,
    });
  });

  test("GET /reddit/accounts/:id/health re-queues when latest snapshot is stale", async () => {
    await prisma.accountHealthSnapshot.create({
      data: {
        workspaceId,
        redditAccountId: accountId,
        healthScore: 72,
        signalsJson: { sampleSize: 8, removals: 1 },
        capturedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      },
    });

    const res = await getAccountHealth(
      new Request(`http://test.local/api/reddit/accounts/${accountId}/health`),
      { params: { id: accountId } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      latestSnapshot: { healthScore: number } | null;
      staleHours: number | null;
      refreshQueued: boolean;
    };
    expect(json.latestSnapshot?.healthScore).toBe(72);
    expect(json.staleHours).not.toBeNull();
    expect((json.staleHours ?? 0) >= 24).toBe(true);
    expect(json.refreshQueued).toBe(true);
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledWith({
      workspaceId,
      redditAccountId: accountId,
    });
  });

  test("POST /reddit/accounts/:id/visibility-check persists check entry", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    try {
      const res = await postVisibilityCheck(
        new Request(
          `http://test.local/api/reddit/accounts/${accountId}/visibility-check`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              permalink: "/r/startups/comments/abc123/example/",
            }),
          },
        ),
        { params: { id: accountId } },
      );

      expect(res.status).toBe(200);
      const json = (await readJson(res)) as {
        check: { result: string; permalink: string };
        queue: { id: string } | null;
      };
      expect(json.check.result).toBe("OK");
      expect(json.check.permalink).toContain("reddit.com");
      expect(json.queue?.id).toBe("job_vis_1");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("POST /tools/post-generate enforces per-IP rate limits", async () => {
    let lastStatus = 0;
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;

    for (let i = 0; i < 21; i += 1) {
      const res = await postGenerateTool(
        new Request("http://test.local/api/tools/post-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            topic: "launching onboarding experiments",
            product: "ReditFast",
            audience: "founders",
            tone: "helpful",
          }),
        }),
      );
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
