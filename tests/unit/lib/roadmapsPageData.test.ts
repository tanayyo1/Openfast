jest.mock("@/lib/server/page-auth", () => ({
  requireWorkspaceSessionForPage: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roadmap: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    roadmapTask: {
      findMany: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
    },
    redditAccount: {
      findMany: jest.fn(),
    },
    draft: {
      count: jest.fn(),
    },
    scheduledPost: {
      count: jest.fn(),
    },
  },
}));

import {
  loadRoadmapDetailPageData,
  loadRoadmapGeneratePageData,
  loadRoadmapsPageData,
  roadmapWindowLabel,
} from "@/lib/roadmapsPageData";

const mockedPageAuth = jest.requireMock("@/lib/server/page-auth") as {
  requireWorkspaceSessionForPage: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  roadmap: { findMany: jest.Mock; findFirst: jest.Mock };
  roadmapTask: { findMany: jest.Mock };
  project: { findMany: jest.Mock };
  redditAccount: { findMany: jest.Mock };
  draft: { count: jest.Mock };
  scheduledPost: { count: jest.Mock };
};

describe("roadmaps page data loaders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPageAuth.requireWorkspaceSessionForPage.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });

    mockedPrisma.roadmap.findMany.mockResolvedValue([]);
    mockedPrisma.roadmap.findFirst.mockResolvedValue(null);
    mockedPrisma.roadmapTask.findMany.mockResolvedValue([]);
    mockedPrisma.project.findMany.mockResolvedValue([]);
    mockedPrisma.redditAccount.findMany.mockResolvedValue([]);
    mockedPrisma.draft.count.mockResolvedValue(0);
    mockedPrisma.scheduledPost.count.mockResolvedValue(0);
  });

  test("loadRoadmapsPageData propagates auth errors", async () => {
    mockedPageAuth.requireWorkspaceSessionForPage.mockRejectedValue(
      new Error("REDIRECT:/login"),
    );

    await expect(loadRoadmapsPageData()).rejects.toThrow("REDIRECT:/login");
  });

  test("loadRoadmapsPageData returns mapped list with project names", async () => {
    const now = new Date("2026-02-21T00:00:00.000Z");
    mockedPrisma.roadmap.findMany.mockResolvedValue([
      {
        id: "rm_1",
        projectId: "p_1",
        version: 2,
        startDate: now,
        horizonDays: 7,
        status: "ACTIVE",
        project: { name: "Openfast" },
      },
    ]);

    const list = await loadRoadmapsPageData();
    expect(list[0]).toMatchObject({
      id: "rm_1",
      projectId: "p_1",
      projectName: "Openfast",
      version: 2,
      horizonDays: 7,
      status: "ACTIVE",
    });
  });

  test("loadRoadmapDetailPageData returns null for inaccessible roadmap", async () => {
    const data = await loadRoadmapDetailPageData("missing");
    expect(data).toBeNull();
  });

  test("loadRoadmapGeneratePageData returns live projects and accounts", async () => {
    mockedPrisma.project.findMany.mockResolvedValue([{ id: "p_1", name: "A" }]);
    mockedPrisma.redditAccount.findMany.mockResolvedValue([
      { id: "ra_1", redditUsername: "user1", safetyTier: "NEW" },
    ]);

    const data = await loadRoadmapGeneratePageData();
    expect(data.projects).toHaveLength(1);
    expect(data.accounts).toHaveLength(1);
  });

  test("roadmapWindowLabel returns inclusive date range", () => {
    const label = roadmapWindowLabel(new Date("2026-02-21T00:00:00.000Z"), 3);
    expect(label).toContain("2/");
    expect(label).toContain("-");
  });
});
