jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/recommendations/generate", () => ({
  generateProjectRecommendations: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roadmap: { findMany: jest.fn() },
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    projectPainPoint: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { GET as listRoadmaps, POST as createRoadmap } from "@/app/api/roadmaps/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  roadmap: { findMany: jest.Mock };
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("roadmaps route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedQuota.getWorkspaceEntitlements.mockResolvedValue({
      maxProjects: 1,
      maxRedditAccounts: 1,
      maxScheduledPosts: 10,
      maxDraftsPerMonth: 10,
      roadmapDays: 7,
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
      hasTeamFeatures: false,
    });
  });

  test("returns 400 for cursor with invalid createdAt value", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", id: "rm_1" }),
      "utf8",
    ).toString("base64url");

    const res = await listRoadmaps(
      new Request(`http://test.local/api/roadmaps?cursor=${cursor}`),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_CURSOR");
    expect(mockedPrisma.roadmap.findMany).not.toHaveBeenCalled();
  });

  test("returns 403 when requested horizon exceeds plan roadmapDays", async () => {
    mockedQuota.getWorkspaceEntitlements.mockResolvedValueOnce({
      maxProjects: 1,
      maxRedditAccounts: 1,
      maxScheduledPosts: 10,
      maxDraftsPerMonth: 10,
      roadmapDays: 3,
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
      hasTeamFeatures: false,
    });

    const res = await createRoadmap(
      new Request("http://test.local/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "p_1", horizonDays: 5 }),
      }),
    );
    expect(res.status).toBe(403);
    const json = (await readJson(res)) as {
      code: string;
      details: { requested: number; maxAllowed: number };
    };
    expect(json.code).toBe("ROADMAP_HORIZON_LIMIT");
    expect(json.details).toEqual({ requested: 5, maxAllowed: 3 });
  });
});
