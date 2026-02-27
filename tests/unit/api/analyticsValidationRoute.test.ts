jest.mock("@/lib/server/admin-guards", () => ({
  requireWorkspaceAdminSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/analytics/validation", () => ({
  validateAnalyticsPipeline: jest.fn(),
}));

import { GET as getAnalyticsValidation } from "@/app/api/analytics/validation/route";

const mockedAdminGuards = jest.requireMock("@/lib/server/admin-guards") as {
  requireWorkspaceAdminSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedValidation = jest.requireMock("@/lib/analytics/validation") as {
  validateAnalyticsPipeline: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("analytics validation route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedAdminGuards.requireWorkspaceAdminSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: true,
    });
    mockedValidation.validateAnalyticsPipeline.mockResolvedValue({
      passed: true,
      checks: [],
      checkedAt: new Date("2026-02-18T00:00:00.000Z"),
      summary: "ok",
    });
  });

  test("returns 401 when admin session is missing", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const res = await getAnalyticsValidation();
    expect(res.status).toBe(401);
    expect(mockedQuota.getWorkspaceEntitlements).not.toHaveBeenCalled();
    expect(mockedValidation.validateAnalyticsPipeline).not.toHaveBeenCalled();
  });

  test("returns 403 when user is not workspace admin", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockRejectedValue(
      new Error("FORBIDDEN"),
    );

    const res = await getAnalyticsValidation();
    expect(res.status).toBe(403);
    expect(mockedQuota.getWorkspaceEntitlements).not.toHaveBeenCalled();
    expect(mockedValidation.validateAnalyticsPipeline).not.toHaveBeenCalled();
  });

  test("returns 403 when advanced analytics is not enabled", async () => {
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: false,
    });

    const res = await getAnalyticsValidation();
    const body = (await readJson(res)) as { code: string };

    expect(res.status).toBe(403);
    expect(body.code).toBe("ADVANCED_ANALYTICS_REQUIRED");
    expect(mockedValidation.validateAnalyticsPipeline).not.toHaveBeenCalled();
  });

  test("passes workspaceId to validation library", async () => {
    const res = await getAnalyticsValidation();
    expect(res.status).toBe(200);
    expect(mockedValidation.validateAnalyticsPipeline).toHaveBeenCalledWith(
      "ws_1",
    );
  });
});
