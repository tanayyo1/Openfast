jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    subredditCatalog: { findMany: jest.fn() },
    projectSubredditRecommendation: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/recommendations/ranking", () => ({
  rankTopSubreddits: jest.fn(),
}));

import { generateProjectRecommendations } from "@/lib/recommendations/generate";
import { rankTopSubreddits } from "@/lib/recommendations/ranking";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  subredditCatalog: { findMany: jest.Mock };
  projectSubredditRecommendation: {
    deleteMany: jest.Mock;
    updateMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockedRanking = rankTopSubreddits as jest.Mock;

describe("generateProjectRecommendations", () => {
  const tx = {
    projectSubredditRecommendation: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  function recommendation(subredditId: string, status: "SELECTED" | "CANDIDATE") {
    return {
      id: `rec_${subredditId}`,
      workspaceId: "ws_1",
      projectId: "p_1",
      subredditId,
      fitScore: 0.7,
      riskScore: 0.2,
      timeWindowScore: 0.6,
      compositeScore: 0.72,
      reasons: { summary: "ok" },
      status,
      selectedAt: status === "SELECTED" ? new Date("2026-01-01T00:00:00.000Z") : null,
      dismissedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      subreddit: {
        id: subredditId,
        name: `sub_${subredditId}`,
        title: `Sub ${subredditId}`,
        subscribers: 1000,
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      description: "tooling",
    });
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([]);
    mockedPrisma.$transaction.mockImplementation(async (handler: Function) =>
      handler(tx),
    );
  });

  test("preserves selected recommendations when no subreddits are discovered", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([{ subredditId: "sub_selected" }])
      .mockResolvedValueOnce([recommendation("sub_selected", "SELECTED")])
      .mockResolvedValueOnce([]);

    const out = await generateProjectRecommendations({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(out.recommendations).toHaveLength(1);
    expect(out.recommendations[0]?.status).toBe("SELECTED");
    expect(mockedPrisma.projectSubredditRecommendation.deleteMany).toHaveBeenCalledWith(
      {
        where: {
          workspaceId: "ws_1",
          projectId: "p_1",
          status: { not: "SELECTED" },
        },
      },
    );
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("refreshes selected scores while creating only non-selected ranked items", async () => {
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([
      {
        id: "sub_selected",
        name: "selected",
        title: "Selected",
        description: "desc",
        nsfw: false,
        isRestricted: false,
        isQuarantined: false,
        policy: null,
        timeSlots: [{ score: 0.7 }],
      },
      {
        id: "sub_candidate",
        name: "candidate",
        title: "Candidate",
        description: "desc",
        nsfw: false,
        isRestricted: false,
        isQuarantined: false,
        policy: null,
        timeSlots: [{ score: 0.6 }],
      },
    ]);
    mockedRanking.mockReturnValue([
      {
        subredditId: "sub_selected",
        fitScore: 0.9,
        riskScore: 0.2,
        timeWindowScore: 0.7,
        compositeScore: 0.8,
      },
      {
        subredditId: "sub_candidate",
        fitScore: 0.7,
        riskScore: 0.25,
        timeWindowScore: 0.65,
        compositeScore: 0.67,
      },
    ]);
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([{ subredditId: "sub_selected" }])
      .mockResolvedValueOnce([
        recommendation("sub_selected", "SELECTED"),
      ])
      .mockResolvedValueOnce([
        recommendation("sub_candidate", "CANDIDATE"),
      ]);

    await generateProjectRecommendations({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(tx.projectSubredditRecommendation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "SELECTED" } }),
      }),
    );
    expect(tx.projectSubredditRecommendation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subredditId: "sub_selected",
          status: "SELECTED",
        }),
      }),
    );
    expect(tx.projectSubredditRecommendation.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            subredditId: "sub_candidate",
            status: "CANDIDATE",
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  test("caps inserted candidates so selected + candidates stay within top 5", async () => {
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue(
      Array.from({ length: 5 }).map((_, idx) => ({
        id: `sub_candidate_${idx + 1}`,
        name: `candidate_${idx + 1}`,
        title: `Candidate ${idx + 1}`,
        description: "desc",
        nsfw: false,
        isRestricted: false,
        isQuarantined: false,
        policy: null,
        timeSlots: [{ score: 0.6 }],
      })),
    );
    mockedRanking.mockReturnValue(
      Array.from({ length: 5 }).map((_, idx) => ({
        subredditId: `sub_candidate_${idx + 1}`,
        fitScore: 0.7,
        riskScore: 0.2,
        timeWindowScore: 0.6,
        compositeScore: 0.75 - idx * 0.01,
      })),
    );
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([
        { subredditId: "sub_selected_1" },
        { subredditId: "sub_selected_2" },
      ])
      .mockResolvedValueOnce([
        recommendation("sub_selected_1", "SELECTED"),
        recommendation("sub_selected_2", "SELECTED"),
      ])
      .mockResolvedValueOnce([
        recommendation("sub_candidate_1", "CANDIDATE"),
        recommendation("sub_candidate_2", "CANDIDATE"),
        recommendation("sub_candidate_3", "CANDIDATE"),
      ]);

    const out = await generateProjectRecommendations({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    const createManyArg = tx.projectSubredditRecommendation.createMany.mock.calls[0]?.[0];
    expect(createManyArg?.data).toHaveLength(3);
    expect(out.recommendations).toHaveLength(5);
  });
});
