jest.mock("@/lib/server/page-auth", () => ({
  requireWorkspaceSessionForPage: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    draft: {
      count: jest.fn(),
    },
    scheduledPost: {
      count: jest.fn(),
    },
    roadmapTask: {
      findMany: jest.fn(),
    },
    roadmap: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

import {
  brandVoiceToText,
  goalsToList,
  loadDashboardPageData,
  loadProjectDetailPageData,
  loadProjectsPageData,
  loadProjectSettingsPageData,
} from "@/lib/dashboardProjectsPageData";

const mockedPageAuth = jest.requireMock("@/lib/server/page-auth") as {
  requireWorkspaceSessionForPage: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
  draft: { count: jest.Mock };
  scheduledPost: { count: jest.Mock };
  roadmapTask: { findMany: jest.Mock };
  roadmap: { count: jest.Mock; findFirst: jest.Mock };
};

describe("dashboard/projects page data loaders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPageAuth.requireWorkspaceSessionForPage.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });

    mockedPrisma.project.count.mockResolvedValue(0);
    mockedPrisma.draft.count.mockResolvedValue(0);
    mockedPrisma.scheduledPost.count.mockResolvedValue(0);
    mockedPrisma.roadmapTask.findMany.mockResolvedValue([]);
    mockedPrisma.project.findMany.mockResolvedValue([]);
    mockedPrisma.project.findFirst.mockResolvedValue(null);
    mockedPrisma.roadmap.count.mockResolvedValue(0);
    mockedPrisma.roadmap.findFirst.mockResolvedValue(null);
  });

  test("loadDashboardPageData propagates auth errors", async () => {
    mockedPageAuth.requireWorkspaceSessionForPage.mockRejectedValue(
      new Error("REDIRECT:/login"),
    );

    await expect(loadDashboardPageData()).rejects.toThrow("REDIRECT:/login");
  });

  test("loadProjectsPageData returns empty array for empty workspace", async () => {
    mockedPrisma.project.findMany.mockResolvedValue([]);

    const items = await loadProjectsPageData();

    expect(items).toEqual([]);
    expect(mockedPrisma.project.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        goals: true,
        status: true,
      },
    });
  });

  test("loadProjectDetailPageData returns null project when not found", async () => {
    const data = await loadProjectDetailPageData("missing_project");

    expect(data.project).toBeNull();
    expect(mockedPrisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "missing_project", workspaceId: "ws_1" },
      select: { id: true, name: true, goals: true },
    });
  });

  test("loadProjectSettingsPageData returns null project when not found", async () => {
    const project = await loadProjectSettingsPageData("missing_project");

    expect(project).toBeNull();
    expect(mockedPrisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "missing_project", workspaceId: "ws_1" },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        goals: true,
        brandVoice: true,
      },
    });
  });

  test("formats goal and brand voice text consistently", () => {
    expect(
      goalsToList({
        primary: "traffic",
        targets: ["founders"],
        kpis: ["ctr"],
      }),
    ).toEqual(["traffic", "founders", "ctr"]);
    expect(
      brandVoiceToText({ tone: "helpful", do: ["educate"], dont: ["spam"] }),
    ).toContain("Tone: helpful");
  });
});
