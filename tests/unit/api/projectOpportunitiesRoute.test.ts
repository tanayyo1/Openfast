jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    threadCandidate: { findMany: jest.fn() },
  },
}));

import { GET as listProjectOpportunities } from "@/app/api/projects/[id]/opportunities/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  threadCandidate: { findMany: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project opportunities route (RED-59)", () => {
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

    const res = await listProjectOpportunities(
      new Request("http://test.local/api/projects/p_1/opportunities"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("returns 404 when project is not in workspace", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const res = await listProjectOpportunities(
      new Request("http://test.local/api/projects/p_missing/opportunities"),
      { params: { id: "p_missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
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

    const res = await listProjectOpportunities(
      new Request("http://test.local/api/projects/p_1/opportunities"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("SMART_FINDER_REQUIRED");
    expect(mockedPrisma.project.findFirst).not.toHaveBeenCalled();
  });

  test("returns empty list when project has no selected/candidate recommendations", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([]);

    const res = await listProjectOpportunities(
      new Request("http://test.local/api/projects/p_1/opportunities?limit=5"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      projectId: string;
      projectName: string;
      count: number;
      items: unknown[];
    };
    expect(json.projectId).toBe("p_1");
    expect(json.projectName).toBe("Acme");
    expect(json.count).toBe(0);
    expect(json.items).toEqual([]);
    expect(mockedPrisma.threadCandidate.findMany).not.toHaveBeenCalled();
  });

  test("returns mapped opportunity feed with recommendation context", async () => {
    const now = new Date("2026-02-20T17:00:00.000Z");
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        subredditId: "sub_1",
        status: "SELECTED",
        fitScore: 0.78,
        compositeScore: 0.66,
      },
    ]);
    mockedPrisma.threadCandidate.findMany.mockResolvedValueOnce([
      {
        id: "opp_1",
        subredditId: "sub_1",
        title: "How do you handle onboarding dropoff?",
        permalink: "https://reddit.com/r/startups/comments/abc123",
        author: "founder_123",
        score: 0.83,
        relevanceScore: 0.76,
        velocityScore: 0.7,
        riskScore: 0.2,
        reasons: { summary: "high relevance, low risk" },
        status: "ACTIVE",
        createdAt: now,
        expiresAt: now,
        subreddit: {
          id: "sub_1",
          name: "startups",
          title: "Startups",
        },
      },
    ]);

    const res = await listProjectOpportunities(
      new Request(
        "http://test.local/api/projects/p_1/opportunities?limit=5&minScore=0.3",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      count: number;
      items: Array<{
        id: string;
        subredditName: string;
        velocity: string;
        risk: string;
        recommendation: { status: string; fitScore: number };
      }>;
    };
    expect(json.count).toBe(1);
    expect(json.items[0]?.id).toBe("opp_1");
    expect(json.items[0]?.subredditName).toBe("startups");
    expect(json.items[0]?.velocity).toBe("Fast");
    expect(json.items[0]?.risk).toBe("Low");
    expect(json.items[0]?.recommendation.status).toBe("SELECTED");
    expect(json.items[0]?.recommendation.fitScore).toBeCloseTo(0.78);
    expect(mockedPrisma.threadCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subredditId: { in: ["sub_1"] },
          status: "ACTIVE",
          score: { gte: 0.3 },
        }),
        take: 5,
      }),
    );
  });
});
