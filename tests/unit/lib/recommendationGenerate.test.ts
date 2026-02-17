jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    subredditCatalog: { findMany: jest.fn() },
    projectSubredditRecommendation: {
      deleteMany: jest.fn(),
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

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  subredditCatalog: { findMany: jest.Mock };
  projectSubredditRecommendation: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("generateProjectRecommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      description: "tooling",
    });
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([]);
  });

  test("clears stale recommendations when no subreddits are discovered", async () => {
    const out = await generateProjectRecommendations({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(out.recommendations).toEqual([]);
    expect(mockedPrisma.projectSubredditRecommendation.deleteMany).toHaveBeenCalledWith(
      {
        where: { workspaceId: "ws_1", projectId: "p_1" },
      },
    );
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
