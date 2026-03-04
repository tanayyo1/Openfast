jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/brandMonitoring/monitor", () => ({
  buildProjectBrandMonitoringSnapshot: jest.fn(),
}));

import { GET as getProjectBrandMonitoring } from "@/app/api/projects/[id]/brand-monitoring/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedMonitor = jest.requireMock("@/lib/brandMonitoring/monitor") as {
  buildProjectBrandMonitoringSnapshot: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project brand monitoring route (RED-61)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      maxProjects: 5,
      maxRedditAccounts: 5,
      maxScheduledPosts: 100,
      maxDraftsPerMonth: 500,
      roadmapDays: 30,
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
      hasTeamFeatures: true,
    });
  });

  test("returns 401 when auth guard fails", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await getProjectBrandMonitoring(
      new Request("http://test.local/api/projects/p_1/brand-monitoring"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("returns 403 when smart finder entitlement is missing", async () => {
    mockedQuota.getWorkspaceEntitlements.mockResolvedValueOnce({
      maxProjects: 1,
      maxRedditAccounts: 1,
      maxScheduledPosts: 10,
      maxDraftsPerMonth: 10,
      roadmapDays: 7,
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
      hasTeamFeatures: false,
    });

    const res = await getProjectBrandMonitoring(
      new Request("http://test.local/api/projects/p_1/brand-monitoring"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("SMART_FINDER_REQUIRED");
    expect(
      mockedMonitor.buildProjectBrandMonitoringSnapshot,
    ).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid query params", async () => {
    const res = await getProjectBrandMonitoring(
      new Request(
        "http://test.local/api/projects/p_1/brand-monitoring?limit=0",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  test("returns 404 when project does not exist in workspace", async () => {
    mockedMonitor.buildProjectBrandMonitoringSnapshot.mockResolvedValueOnce(
      null,
    );

    const res = await getProjectBrandMonitoring(
      new Request("http://test.local/api/projects/p_missing/brand-monitoring"),
      { params: { id: "p_missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });

  test("returns ranked monitoring snapshot for project", async () => {
    mockedMonitor.buildProjectBrandMonitoringSnapshot.mockResolvedValueOnce({
      projectId: "p_1",
      projectName: "Acme",
      lookbackDays: 14,
      keywords: ["acme", "onboarding"],
      summary: {
        high: 1,
        medium: 0,
        low: 0,
        positive: 0,
        neutral: 0,
        negative: 1,
      },
      count: 1,
      items: [
        {
          id: "mention_1",
          subredditId: "sub_1",
          subredditName: "startups",
          subredditTitle: "Startups",
          title: "Acme onboarding is broken for new users",
          permalink: "https://reddit.com/r/startups/comments/abc123",
          author: "founder_1",
          status: "ACTIVE",
          opportunityScore: 0.82,
          velocityScore: 0.71,
          riskScore: 0.21,
          sentiment: "NEGATIVE",
          urgency: "HIGH",
          mentionScore: 7,
          matchedKeywords: ["acme", "onboarding"],
          createdAt: new Date("2026-02-20T10:00:00.000Z"),
          expiresAt: new Date("2026-02-22T10:00:00.000Z"),
        },
      ],
    });

    const res = await getProjectBrandMonitoring(
      new Request(
        "http://test.local/api/projects/p_1/brand-monitoring?limit=10&lookbackDays=7",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      projectId: string;
      count: number;
      generatedAt: string;
      items: Array<{ urgency: string; sentiment: string }>;
    };
    expect(json.projectId).toBe("p_1");
    expect(json.count).toBe(1);
    expect(json.items[0]?.urgency).toBe("HIGH");
    expect(json.items[0]?.sentiment).toBe("NEGATIVE");
    expect(typeof json.generatedAt).toBe("string");
    expect(
      mockedMonitor.buildProjectBrandMonitoringSnapshot,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        projectId: "p_1",
        limit: 10,
        lookbackDays: 7,
      }),
    );
  });
});
