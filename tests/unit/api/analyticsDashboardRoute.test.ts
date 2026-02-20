jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/analytics/dashboardData", () => ({
  getWorkspaceDashboardData: jest.fn(),
}));

import { GET as getDashboardAnalytics } from "@/app/api/analytics/dashboard/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedDashboardData = jest.requireMock(
  "@/lib/analytics/dashboardData",
) as {
  getWorkspaceDashboardData: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function buildDashboardData(source: "rollup" | "live") {
  return {
    source,
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
    mockedDashboardData.getWorkspaceDashboardData.mockResolvedValue(
      buildDashboardData("live"),
    );
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
    expect(mockedDashboardData.getWorkspaceDashboardData).not.toHaveBeenCalled();
  });

  test("uses fresh rollup payload when available", async () => {
    mockedDashboardData.getWorkspaceDashboardData.mockResolvedValue(
      buildDashboardData("rollup"),
    );

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
    expect(mockedDashboardData.getWorkspaceDashboardData).toHaveBeenCalledWith(
      "ws_1",
    );
  });

  test("falls back to live snapshot when rollup is stale", async () => {
    mockedDashboardData.getWorkspaceDashboardData.mockResolvedValue(
      buildDashboardData("live"),
    );

    const res = await getDashboardAnalytics();
    const body = (await readJson(res)) as { source: string };

    expect(res.status).toBe(200);
    expect(body.source).toBe("live");
    expect(mockedDashboardData.getWorkspaceDashboardData).toHaveBeenCalledWith(
      "ws_1",
    );
  });
});
