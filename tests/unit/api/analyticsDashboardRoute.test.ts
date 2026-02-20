jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/analytics/rollups", () => ({
  getLatestWorkspaceDailyRollup: jest.fn(),
}));

jest.mock("@/lib/analytics/dashboardSnapshot", () => ({
  computeWorkspaceDashboardSnapshot: jest.fn(),
}));

import { GET as getDashboardAnalytics } from "@/app/api/analytics/dashboard/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedRollups = jest.requireMock("@/lib/analytics/rollups") as {
  getLatestWorkspaceDailyRollup: jest.Mock;
};
const mockedSnapshot = jest.requireMock("@/lib/analytics/dashboardSnapshot") as {
  computeWorkspaceDashboardSnapshot: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function buildRollupPayload() {
  return {
    workspaceId: "ws_1",
    forDate: "2026-02-20",
    generatedAt: "2026-02-20T04:00:00.000Z",
    summary: {
      projectCount: 2,
      publishedCount: 3,
      removedCount: 1,
      totalScore: 42,
      avgScore: 14,
      totalComments: 15,
      avgComments: 5,
      scheduledCount: 1,
      publishingCount: 0,
      failedCount: 0,
      cancelledCount: 0,
    },
    byProject: [
      {
        projectId: "p_1",
        projectName: "Project 1",
        projectStatus: "ACTIVE",
        publishedCount: 3,
        removedCount: 1,
        totalScore: 42,
        totalComments: 15,
        scheduledCount: 1,
        failedCount: 0,
        avgScore: 14,
        avgComments: 5,
      },
    ],
  };
}

describe("analytics dashboard route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: true,
    });
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValue(null);
    mockedSnapshot.computeWorkspaceDashboardSnapshot.mockResolvedValue({
      summary: {
        projectCount: 1,
        publishedCount: 1,
        removedCount: 0,
        totalScore: 10,
        avgScore: 10,
        totalComments: 2,
        avgComments: 2,
        scheduledCount: 0,
        publishingCount: 0,
        failedCount: 0,
        cancelledCount: 0,
      },
      byProject: [],
    });
  });

  test("returns 401 on unauthorized session", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );
    const res = await getDashboardAnalytics();
    expect(res.status).toBe(401);
  });

  test("returns 403 when advanced analytics is disabled", async () => {
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: false,
    });

    const res = await getDashboardAnalytics();
    expect(res.status).toBe(403);
    expect(mockedRollups.getLatestWorkspaceDailyRollup).not.toHaveBeenCalled();
    expect(mockedSnapshot.computeWorkspaceDashboardSnapshot).not.toHaveBeenCalled();
  });

  test("uses fresh rollup payload when available", async () => {
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValue({
      id: "rollup_ws_1_2026-02-20",
      eventTs: new Date("2026-02-20T00:00:00.000Z"),
      ingestedAt: new Date(Date.now() - 60 * 60 * 1000),
      payload: buildRollupPayload(),
    });

    const res = await getDashboardAnalytics();
    const body = (await readJson(res)) as {
      source: string;
      generatedAt: string;
      summary: { totalScore: number };
    };

    expect(res.status).toBe(200);
    expect(body.source).toBe("rollup");
    expect(body.generatedAt).toBe("2026-02-20T04:00:00.000Z");
    expect(body.summary.totalScore).toBe(42);
    expect(mockedSnapshot.computeWorkspaceDashboardSnapshot).not.toHaveBeenCalled();
  });

  test("falls back to live snapshot when rollup is stale", async () => {
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValue({
      id: "rollup_ws_1_2026-02-18",
      eventTs: new Date("2026-02-18T00:00:00.000Z"),
      ingestedAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
      payload: buildRollupPayload(),
    });

    const res = await getDashboardAnalytics();
    const body = (await readJson(res)) as { source: string };

    expect(res.status).toBe(200);
    expect(body.source).toBe("live");
    expect(mockedSnapshot.computeWorkspaceDashboardSnapshot).toHaveBeenCalledWith(
      "ws_1",
    );
  });
});
