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
});
