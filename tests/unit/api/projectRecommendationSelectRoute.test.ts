jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { POST as selectRecommendations } from "@/app/api/projects/[id]/recommendations/select/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe("project recommendation select route", () => {
  const tx = {
    projectSubredditRecommendation: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1" });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValue([
      { subredditId: "sub_1" },
      { subredditId: "sub_2" },
    ]);
    tx.projectSubredditRecommendation.findMany.mockResolvedValue([
      {
        id: "rec_1",
        subredditId: "sub_1",
        compositeScore: 0.81,
        selectedAt: new Date(),
      },
      {
        id: "rec_2",
        subredditId: "sub_2",
        compositeScore: 0.72,
        selectedAt: new Date(),
      },
    ]);
    mockedPrisma.$transaction.mockImplementation(async (handler: Function) =>
      handler(tx),
    );
  });

  test("clears dismissedAt when resetting and selecting recommendations", async () => {
    const res = await selectRecommendations(
      new Request("http://test.local/api/projects/p_1/recommendations/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subredditIds: ["sub_1", "sub_2"] }),
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(tx.projectSubredditRecommendation.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANDIDATE",
          selectedAt: null,
          dismissedAt: null,
        }),
      }),
    );
    expect(tx.projectSubredditRecommendation.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SELECTED",
          dismissedAt: null,
        }),
      }),
    );
  });
});
