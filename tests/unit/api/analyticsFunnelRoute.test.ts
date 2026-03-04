jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/analytics/funnel", () => ({
  getFunnelData: jest.fn(),
  getEventCountsLast24h: jest.fn(),
  getFullFunnelPaths: jest.fn(),
  getTimeToFirstValueMetrics: jest.fn(),
}));

import { GET as getAnalyticsFunnel } from "@/app/api/analytics/funnel/route";
import { resolveDateRange } from "@/lib/analytics/dateRange";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedFunnel = jest.requireMock("@/lib/analytics/funnel") as {
  getFunnelData: jest.Mock;
  getEventCountsLast24h: jest.Mock;
  getFullFunnelPaths: jest.Mock;
  getTimeToFirstValueMetrics: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("analytics funnel route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: true,
    });
    mockedFunnel.getFunnelData.mockResolvedValue({
      stages: [],
      dropoffs: [],
      period: {
        start: new Date("2026-02-10T00:00:00.000Z"),
        end: new Date("2026-02-11T00:00:00.000Z"),
      },
    });
    mockedFunnel.getEventCountsLast24h.mockResolvedValue([]);
    mockedFunnel.getFullFunnelPaths.mockResolvedValue([]);
    mockedFunnel.getTimeToFirstValueMetrics.mockResolvedValue({
      sampleSize: 0,
      avgMinutes: null,
      p50Minutes: null,
      p90Minutes: null,
      minMinutes: null,
      maxMinutes: null,
    });
  });

  test("returns 400 for invalid explicit dates", async () => {
    const res = await getAnalyticsFunnel(
      new Request(
        "http://test.local/api/analytics/funnel?start=nope&end=2026-02-11",
      ),
    );

    expect(res.status).toBe(400);
    expect(mockedFunnel.getFunnelData).not.toHaveBeenCalled();
  });

  test("returns 400 when only one boundary date is provided", async () => {
    const res = await getAnalyticsFunnel(
      new Request("http://test.local/api/analytics/funnel?start=2026-02-10"),
    );

    expect(res.status).toBe(400);
    expect(mockedFunnel.getEventCountsLast24h).not.toHaveBeenCalled();
  });

  test("passes workspaceId to analytics query functions", async () => {
    const res = await getAnalyticsFunnel(
      new Request(
        "http://test.local/api/analytics/funnel?start=2026-02-10T00:00:00.000Z&end=2026-02-11T00:00:00.000Z",
      ),
    );
    const json = (await readJson(res)) as {
      ttfv?: { sampleSize: number };
    };

    expect(res.status).toBe(200);
    expect(json.ttfv).toEqual({
      sampleSize: 0,
      avgMinutes: null,
      p50Minutes: null,
      p90Minutes: null,
      minMinutes: null,
      maxMinutes: null,
    });
    expect(mockedFunnel.getFunnelData).toHaveBeenCalledWith(
      "ws_1",
      expect.any(Date),
      expect.any(Date),
    );
    expect(mockedFunnel.getEventCountsLast24h).toHaveBeenCalledWith("ws_1");
    expect(mockedFunnel.getFullFunnelPaths).toHaveBeenCalledWith(
      "ws_1",
      expect.any(Date),
      expect.any(Date),
      5,
    );
    expect(mockedFunnel.getTimeToFirstValueMetrics).toHaveBeenCalledWith(
      "ws_1",
      expect.any(Date),
      expect.any(Date),
    );
  });

  test("returns 403 when advanced analytics is not enabled", async () => {
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      hasAdvancedAnalytics: false,
    });

    const res = await getAnalyticsFunnel(
      new Request("http://test.local/api/analytics/funnel"),
    );
    expect(res.status).toBe(403);
    expect(mockedFunnel.getFunnelData).not.toHaveBeenCalled();
  });

  test("resolveDateRange rejects invalid period values", () => {
    const out = resolveDateRange(new URLSearchParams("period=1y"));
    expect(out.ok).toBe(false);
  });

  test("resolveDateRange builds period window for defaults", () => {
    const now = new Date("2026-02-18T12:00:00.000Z");
    const out = resolveDateRange(new URLSearchParams(), now);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.endDate.toISOString()).toBe("2026-02-18T12:00:00.000Z");
    expect(out.startDate.toISOString()).toBe("2026-02-11T12:00:00.000Z");
  });

  test("returns auth errors when workspace session fails", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const res = await getAnalyticsFunnel(
      new Request("http://test.local/api/analytics/funnel"),
    );
    const json = (await readJson(res)) as { error: string };
    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });
});
