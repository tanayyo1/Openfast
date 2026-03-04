jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/ops/workspaceQueueHealth", () => ({
  getWorkspaceQueueHealthSnapshot: jest.fn(),
}));

import { GET as getQueueHealth } from "@/app/api/scheduling/queue-health/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueueHealth = jest.requireMock(
  "@/lib/ops/workspaceQueueHealth",
) as {
  getWorkspaceQueueHealthSnapshot: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("scheduling queue health route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedQueueHealth.getWorkspaceQueueHealthSnapshot.mockResolvedValue({
      generatedAt: "2026-02-21T12:00:00.000Z",
      level: "OK",
      reasons: [],
      isIdle: true,
      counts: {
        scheduled: 0,
        pendingApproval: 0,
        queued: 0,
        dueNow: 0,
        overdue: 0,
        publishing: 0,
        stalePublishing: 0,
        published: 0,
        failedRetryable: 0,
        failedPermanent: 0,
        cancelled: 0,
      },
      schedule: {
        nextRunAt: null,
        oldestDueAt: null,
      },
      thresholds: {
        overdueGraceMinutes: 15,
        stalePublishingMinutes: 30,
        criticalOverdueCount: 5,
      },
    });
  });

  test("returns 401 for unauthorized sessions", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const res = await getQueueHealth();
    expect(res.status).toBe(401);
  });

  test("returns 400 when user has no workspace", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("WORKSPACE_REQUIRED"),
    );

    const res = await getQueueHealth();
    const body = (await readJson(res)) as { code: string };

    expect(res.status).toBe(400);
    expect(body.code).toBe("WORKSPACE_REQUIRED");
  });

  test("returns queue health payload for workspace user", async () => {
    const res = await getQueueHealth();
    const body = (await readJson(res)) as {
      health: { level: string; generatedAt: string };
    };

    expect(res.status).toBe(200);
    expect(body.health.level).toBe("OK");
    expect(body.health.generatedAt).toBe("2026-02-21T12:00:00.000Z");
    expect(
      mockedQueueHealth.getWorkspaceQueueHealthSnapshot,
    ).toHaveBeenCalledWith("ws_1");
  });

  test("returns 500 when health service fails", async () => {
    mockedQueueHealth.getWorkspaceQueueHealthSnapshot.mockRejectedValue(
      new Error("db timeout"),
    );

    const res = await getQueueHealth();
    const body = (await readJson(res)) as { code: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
