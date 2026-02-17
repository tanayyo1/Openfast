jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    threadCandidate: { findMany: jest.fn() },
    projectPainPoint: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/painPoints/extract", () => ({
  extractPainPointCandidates: jest.fn(),
}));

import { generateProjectPainPoints } from "@/lib/painPoints/generate";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  threadCandidate: { findMany: jest.Mock };
  projectPainPoint: { deleteMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const mockedExtract = jest.requireMock("@/lib/painPoints/extract") as {
  extractPainPointCandidates: jest.Mock;
};

describe("generateProjectPainPoints", () => {
  const tx = {
    projectPainPoint: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1", name: "Acme" });
    mockedPrisma.$transaction.mockImplementation(async (handler: Function) =>
      handler(tx),
    );
    mockedPrisma.projectPainPoint.findMany.mockResolvedValue([]);
    mockedPrisma.threadCandidate.findMany.mockResolvedValue([]);
    mockedExtract.extractPainPointCandidates.mockReturnValue([]);
  });

  test("prioritizes selected recommendations and only backfills remaining slots with candidates", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([
        { subredditId: "sub_selected", status: "SELECTED" },
      ])
      .mockResolvedValueOnce([
        { subredditId: "sub_candidate", status: "CANDIDATE" },
      ]);

    await generateProjectPainPoints({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(mockedPrisma.projectSubredditRecommendation.findMany).toHaveBeenCalledTimes(
      2,
    );
    expect(
      mockedPrisma.projectSubredditRecommendation.findMany.mock.calls[0]?.[0],
    ).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SELECTED" }),
        take: 8,
      }),
    );
    expect(
      mockedPrisma.projectSubredditRecommendation.findMany.mock.calls[1]?.[0],
    ).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CANDIDATE" }),
        take: 7,
      }),
    );
  });

  test("samples thread candidates per subreddit to prevent one subreddit from starving others", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([
        { subredditId: "sub_1", status: "SELECTED" },
        { subredditId: "sub_2", status: "SELECTED" },
      ])
      .mockResolvedValueOnce([]);

    await generateProjectPainPoints({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(mockedPrisma.threadCandidate.findMany).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.threadCandidate.findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ subredditId: "sub_1" }),
        take: 40,
      }),
    );
    expect(mockedPrisma.threadCandidate.findMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ subredditId: "sub_2" }),
        take: 40,
      }),
    );
  });

  test("skips candidate lookup when selected recommendations already fill all slots", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce(
      Array.from({ length: 8 }, (_, index) => ({
        subredditId: `sub_selected_${index}`,
        status: "SELECTED",
      })),
    );

    await generateProjectPainPoints({
      workspaceId: "ws_1",
      projectId: "p_1",
    });

    expect(mockedPrisma.projectSubredditRecommendation.findMany).toHaveBeenCalledTimes(
      1,
    );
  });
});
