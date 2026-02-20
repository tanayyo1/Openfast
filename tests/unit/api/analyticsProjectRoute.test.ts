jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/analytics/projectSnapshot", () => ({
  computeProjectAnalyticsSnapshot: jest.fn(),
}));

import { GET as getProjectAnalytics } from "@/app/api/analytics/projects/[id]/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedSnapshot = jest.requireMock("@/lib/analytics/projectSnapshot") as {
  computeProjectAnalyticsSnapshot: jest.Mock;
};

describe("analytics project route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: true,
    });
    mockedSnapshot.computeProjectAnalyticsSnapshot.mockResolvedValue({
      project: { id: "p_1", name: "Project", status: "ACTIVE" },
      summary: {
        publishedCount: 0,
        scheduledCount: 0,
        publishingCount: 0,
        publishedStatusCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        removedCount: 0,
        totalScore: 0,
        avgScore: 0,
        totalComments: 0,
        avgComments: 0,
        latestCapturedAt: null,
      },
      items: [],
      trend: [],
      page: { limit: 100, hasMore: false, nextCursor: null },
    });
  });

  test("passes parsed pagination and trend params to snapshot loader", async () => {
    const res = await getProjectAnalytics(
      new Request(
        "http://test.local/api/analytics/projects/p_1?limit=25&cursor=pi_9&days=30",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(mockedSnapshot.computeProjectAnalyticsSnapshot).toHaveBeenCalledWith(
      "ws_1",
      "p_1",
      {
        itemLimit: 25,
        cursor: "pi_9",
        trendDays: 30,
      },
    );
  });

  test("omits empty params and allows defaults", async () => {
    const res = await getProjectAnalytics(
      new Request("http://test.local/api/analytics/projects/p_1"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(mockedSnapshot.computeProjectAnalyticsSnapshot).toHaveBeenCalledWith(
      "ws_1",
      "p_1",
      {
        itemLimit: undefined,
        cursor: null,
        trendDays: undefined,
      },
    );
  });
});
