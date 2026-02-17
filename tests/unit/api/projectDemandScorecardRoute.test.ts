jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    projectPainPoint: { findMany: jest.fn() },
  },
}));

import { GET as getDemandScorecard } from "@/app/api/projects/[id]/demand-scorecard/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  projectPainPoint: { findMany: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project demand-scorecard route (RED-57)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("returns 404 when project is missing", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const res = await getDemandScorecard(
      new Request("http://test.local/api/projects/p_missing/demand-scorecard"),
      { params: { id: "p_missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });

  test("returns computed scorecard summary", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: { primary: "trial-signups" },
      constraints: null,
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        fitScore: 0.78,
        riskScore: 0.22,
        timeWindowScore: 0.67,
        status: "SELECTED",
        subreddit: {
          subscribers: 540000,
          activeUsers: 7100,
          avgCommentsPerPost: 18,
        },
      },
      {
        fitScore: 0.7,
        riskScore: 0.3,
        timeWindowScore: 0.62,
        status: "CANDIDATE",
        subreddit: {
          subscribers: 210000,
          activeUsers: 3200,
          avgCommentsPerPost: 14,
        },
      },
    ]);
    mockedPrisma.projectPainPoint.findMany.mockResolvedValueOnce([
      { severityScore: 0.75, confidenceScore: 0.7, frequency: 4 },
      { severityScore: 0.64, confidenceScore: 0.72, frequency: 3 },
      { severityScore: 0.71, confidenceScore: 0.65, frequency: 5 },
    ]);

    const res = await getDemandScorecard(
      new Request("http://test.local/api/projects/p_1/demand-scorecard"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      projectId: string;
      scorecard: {
        overallDemandScore: number;
        marketTier: string;
        coverage: { selectedRecommendations: number };
        components: { fit: number; painIntensity: number };
      };
    };

    expect(json.projectId).toBe("p_1");
    expect(json.scorecard.overallDemandScore).toBeGreaterThan(0);
    expect(["HIGH", "MEDIUM", "EARLY"]).toContain(json.scorecard.marketTier);
    expect(json.scorecard.coverage.selectedRecommendations).toBe(1);
    expect(json.scorecard.components.fit).toBeGreaterThan(0);
    expect(json.scorecard.components.painIntensity).toBeGreaterThan(0);
  });

  test("returns auth error when workspace session fails", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await getDemandScorecard(
      new Request("http://test.local/api/projects/p_1/demand-scorecard"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string; error: string };
    expect(json.code).toBe("UNAUTHORIZED");
    expect(json.error).toBe("Unauthorized");
  });

  test("returns unknown tier with blockers when recommendations are empty", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_empty_rec",
      name: "No recs",
    });
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockedPrisma.projectPainPoint.findMany.mockResolvedValueOnce([
      { severityScore: 0.8, confidenceScore: 0.8, frequency: 5 },
    ]);

    const res = await getDemandScorecard(
      new Request("http://test.local/api/projects/p_empty_rec/demand-scorecard"),
      { params: { id: "p_empty_rec" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      scorecard: {
        overallDemandScore: number;
        marketTier: string;
        blockers: string[];
      };
    };
    expect(json.scorecard.overallDemandScore).toBe(0);
    expect(json.scorecard.marketTier).toBe("UNKNOWN");
    expect(json.scorecard.blockers.length).toBeGreaterThan(0);
  });

  test("returns zero painIntensity when pain points are empty", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_no_pains",
      name: "No pains",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        fitScore: 0.8,
        riskScore: 0.2,
        timeWindowScore: 0.6,
        status: "SELECTED",
        subreddit: {
          subscribers: 100000,
          activeUsers: 2000,
          avgCommentsPerPost: 10,
        },
      },
    ]);
    mockedPrisma.projectPainPoint.findMany.mockResolvedValueOnce([]);

    const res = await getDemandScorecard(
      new Request("http://test.local/api/projects/p_no_pains/demand-scorecard"),
      { params: { id: "p_no_pains" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      scorecard: { components: { painIntensity: number } };
    };
    expect(json.scorecard.components.painIntensity).toBe(0);
  });
});
