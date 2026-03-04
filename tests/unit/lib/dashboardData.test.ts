jest.mock("@/lib/analytics/rollups", () => ({
  getLatestWorkspaceDailyRollup: jest.fn(),
}));

jest.mock("@/lib/analytics/dashboardSnapshot", () => ({
  computeWorkspaceDashboardSnapshot: jest.fn(),
}));

jest.mock("@/lib/analytics/trends", () => ({
  getWorkspaceDailyPerformanceTrend: jest.fn(),
}));

import { getWorkspaceDashboardData } from "@/lib/analytics/dashboardData";

const mockedRollups = jest.requireMock("@/lib/analytics/rollups") as {
  getLatestWorkspaceDailyRollup: jest.Mock;
};
const mockedSnapshot = jest.requireMock(
  "@/lib/analytics/dashboardSnapshot",
) as {
  computeWorkspaceDashboardSnapshot: jest.Mock;
};
const mockedTrends = jest.requireMock("@/lib/analytics/trends") as {
  getWorkspaceDailyPerformanceTrend: jest.Mock;
};

function buildSnapshot() {
  return {
    summary: {
      projectCount: 1,
      publishedCount: 2,
      removedCount: 0,
      totalScore: 20,
      avgScore: 10,
      totalComments: 8,
      avgComments: 4,
      scheduledCount: 1,
      publishingCount: 0,
      failedCount: 0,
      cancelledCount: 0,
    },
    byProject: [],
  };
}

describe("getWorkspaceDashboardData", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValue(null);
    mockedSnapshot.computeWorkspaceDashboardSnapshot.mockResolvedValue(
      buildSnapshot(),
    );
    mockedTrends.getWorkspaceDailyPerformanceTrend.mockResolvedValue([
      {
        day: "2026-02-20",
        totalScore: 20,
        totalComments: 8,
        removedCount: 0,
        activeItems: 2,
      },
    ]);
  });

  test("uses fresh rollup when available", async () => {
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValueOnce({
      id: "rollup_ws_1_2026-02-20",
      eventTs: new Date("2026-02-20T00:00:00.000Z"),
      ingestedAt: new Date("2026-02-20T07:00:00.000Z"),
      payload: {
        workspaceId: "ws_1",
        forDate: "2026-02-20",
        generatedAt: "2026-02-20T07:00:00.000Z",
        ...buildSnapshot(),
      },
    });

    const out = await getWorkspaceDashboardData("ws_1", {
      now: new Date("2026-02-20T08:00:00.000Z"),
    });

    expect(out.source).toBe("rollup");
    expect(out.generatedAt).toBe("2026-02-20T07:00:00.000Z");
    expect(out.trend).toHaveLength(1);
    expect(
      mockedSnapshot.computeWorkspaceDashboardSnapshot,
    ).not.toHaveBeenCalled();
  });

  test("falls back to live snapshot when rollup is stale", async () => {
    mockedRollups.getLatestWorkspaceDailyRollup.mockResolvedValueOnce({
      id: "rollup_ws_1_2026-02-18",
      eventTs: new Date("2026-02-18T00:00:00.000Z"),
      ingestedAt: new Date("2026-02-18T00:00:00.000Z"),
      payload: {
        workspaceId: "ws_1",
        forDate: "2026-02-18",
        generatedAt: "2026-02-18T00:00:00.000Z",
        ...buildSnapshot(),
      },
    });

    const out = await getWorkspaceDashboardData("ws_1", {
      now: new Date("2026-02-20T08:00:00.000Z"),
    });

    expect(out.source).toBe("live");
    expect(out.generatedAt).toBe("2026-02-20T08:00:00.000Z");
    expect(out.trend).toHaveLength(1);
    expect(
      mockedSnapshot.computeWorkspaceDashboardSnapshot,
    ).toHaveBeenCalledWith("ws_1");
  });
});
