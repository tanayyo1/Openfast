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

import {
  GET as listRoadmaps,
  POST as createRoadmap,
} from "@/app/api/roadmaps/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  roadmap: { findMany: jest.Mock };
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  projectPainPoint: { findMany: jest.Mock };
  $transaction: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  getWorkspaceEntitlements: jest.Mock;
};
const mockedRecommendations = jest.requireMock(
  "@/lib/recommendations/generate",
) as {
  generateProjectRecommendations: jest.Mock;
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
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1" });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValue([]);
    mockedPrisma.projectPainPoint.findMany.mockResolvedValue([]);
    mockedRecommendations.generateProjectRecommendations.mockResolvedValue(
      undefined,
    );
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

  test("uses array reasons in roadmap task instructions", async () => {
    const now = new Date("2026-02-20T00:00:00.000Z");
    const tx = {
      roadmap: {
        create: jest.fn().mockResolvedValue({
          id: "rm_1",
          projectId: "p_1",
          startDate: now,
          horizonDays: 1,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        }),
      },
      roadmapTask: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockedPrisma.$transaction.mockImplementationOnce(
      async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx),
    );
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([
        {
          subredditId: "sub_1",
          fitScore: 0.7,
          riskScore: 0.2,
          compositeScore: 0.61,
          reasons: ["Niche match 70%.", "Goal alignment 55%."],
          subreddit: { id: "sub_1", name: "saas", title: "SaaS" },
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await createRoadmap(
      new Request("http://test.local/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "p_1", horizonDays: 1 }),
      }),
    );

    expect(res.status).toBe(201);
    const taskCreateInput = tx.roadmapTask.createMany.mock.calls[0]?.[0] as {
      data: Array<{ instructions: string }>;
    };
    expect(taskCreateInput.data[0]?.instructions).toMatch(/Niche match 70%/i);
    expect(taskCreateInput.data[0]?.instructions).not.toMatch(
      /Good fit based on project niche/i,
    );
  });
});
