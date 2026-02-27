jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueRiskAccountHealthJob: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    redditAccount: { findFirst: jest.fn() },
    accountHealthSnapshot: { findFirst: jest.fn() },
  },
}));

import { GET as getAccountHealth } from "@/app/api/reddit/accounts/[id]/health/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueRiskAccountHealthJob: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  redditAccount: { findFirst: jest.Mock };
  accountHealthSnapshot: { findFirst: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("reddit account health route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      workspaceId: "ws_1",
      redditUsername: "demo",
      safetyTier: "ESTABLISHED",
      isActive: true,
    });
    mockedQueue.enqueueRiskAccountHealthJob.mockResolvedValue({
      id: "job_health_1",
    });
  });

  test("queues refresh when snapshot is missing", async () => {
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue(null);

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      latestSnapshot: unknown;
      refreshQueued: boolean;
      staleHours: number | null;
    };
    expect(json.latestSnapshot).toBeNull();
    expect(json.refreshQueued).toBe(true);
    expect(json.staleHours).toBeNull();
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      redditAccountId: "ra_1",
    });
    expect(mockedPrisma.redditAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "ra_1",
          workspace: { members: { some: { userId: "u_1" } } },
        },
      }),
    );
  });

  test("returns warning when refresh queue is unavailable", async () => {
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue(null);
    mockedQueue.enqueueRiskAccountHealthJob.mockRejectedValue(
      new Error("queue down"),
    );

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      refreshQueued: boolean;
      warnings: string[];
    };
    expect(json.refreshQueued).toBe(false);
    expect(json.warnings).toContain(
      "Health snapshot refresh could not be queued. Try again in a minute.",
    );
  });

  test("queues refresh when snapshot is stale", async () => {
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      id: "hs_1",
      healthScore: 70,
      capturedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    });

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      refreshQueued: boolean;
      staleHours: number | null;
    };
    expect(json.refreshQueued).toBe(true);
    expect((json.staleHours ?? 0) >= 24).toBe(true);
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledTimes(1);
  });

  test("does not queue refresh for inactive accounts", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      workspaceId: "ws_1",
      redditUsername: "demo",
      safetyTier: "ESTABLISHED",
      isActive: false,
    });
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue(null);

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      refreshQueued: boolean;
      warnings: string[];
    };
    expect(json.refreshQueued).toBe(false);
    expect(json.warnings).toContain("Reddit account is inactive.");
    expect(mockedQueue.enqueueRiskAccountHealthJob).not.toHaveBeenCalled();
  });

  test("forces comment-only guardrail for restricted safety tier", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      workspaceId: "ws_1",
      redditUsername: "demo",
      safetyTier: "RESTRICTED",
      isActive: true,
    });
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      id: "hs_1",
      healthScore: 88,
      capturedAt: new Date(),
    });

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      guardrails: { blockPublishing: boolean; recommendCommentsOnly: boolean };
      warnings: string[];
    };
    expect(json.guardrails.blockPublishing).toBe(true);
    expect(json.guardrails.recommendCommentsOnly).toBe(true);
    expect(json.warnings).toContain(
      "Account is restricted. Avoid post scheduling until recovered.",
    );
  });

  test("maps non-auth session setup errors with explicit status", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("SUPABASE_NOT_CONFIGURED"),
    );

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(500);
    const json = (await readJson(res)) as { error: string; code: string };
    expect(json.error).toBe("Supabase is not configured");
    expect(json.code).toBe("SUPABASE_NOT_CONFIGURED");
  });

  test("re-queues snapshot when capturedAt is in the future", async () => {
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      id: "hs_future",
      healthScore: 82,
      capturedAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      refreshQueued: boolean;
      staleHours: number | null;
    };
    expect(json.staleHours).toBe(0);
    expect(json.refreshQueued).toBe(true);
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      redditAccountId: "ra_1",
    });
  });

  test("handles invalid health score snapshots without false low-score warning", async () => {
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      id: "hs_nan",
      healthScore: Number.NaN,
      capturedAt: new Date(),
    });

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      warnings: string[];
      guardrails: { blockPublishing: boolean; recommendCommentsOnly: boolean };
    };

    expect(json.warnings).toContain(
      "Latest health snapshot is invalid. Refresh account health before scheduling posts.",
    );
    expect(json.warnings).not.toContain(
      "Health score is low. Prefer comments and slower pacing.",
    );
    expect(json.guardrails.blockPublishing).toBe(false);
    expect(json.guardrails.recommendCommentsOnly).toBe(false);
  });

  test("uses matched account workspace for queueing when it differs from default session workspace", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      workspaceId: "ws_other",
      redditUsername: "demo",
      safetyTier: "ESTABLISHED",
      isActive: true,
    });
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue(null);

    const res = await getAccountHealth(
      new Request("http://test.local/api/reddit/accounts/ra_1/health"),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    expect(mockedQueue.enqueueRiskAccountHealthJob).toHaveBeenCalledWith({
      workspaceId: "ws_other",
      redditAccountId: "ra_1",
    });
  });
});
