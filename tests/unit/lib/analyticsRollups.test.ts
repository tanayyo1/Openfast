jest.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findMany: jest.fn() },
    analyticsEvent: { upsert: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock("@/lib/analytics/dashboardSnapshot", () => ({
  computeWorkspaceDashboardSnapshot: jest.fn(),
}));

import {
  getLatestWorkspaceDailyRollup,
  persistWorkspaceDailyRollup,
  runWorkspaceDailyRollups,
} from "@/lib/analytics/rollups";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  workspace: { findMany: jest.Mock };
  analyticsEvent: { upsert: jest.Mock; findFirst: jest.Mock };
};
const mockedDashboardSnapshot = jest.requireMock(
  "@/lib/analytics/dashboardSnapshot",
) as {
  computeWorkspaceDashboardSnapshot: jest.Mock;
};

describe("analytics rollups", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.workspace.findMany.mockResolvedValue([]);
    mockedDashboardSnapshot.computeWorkspaceDashboardSnapshot.mockResolvedValue(
      {
        summary: {
          projectCount: 1,
          publishedCount: 2,
          removedCount: 0,
          totalScore: 20,
          avgScore: 10,
          totalComments: 5,
          avgComments: 2.5,
          scheduledCount: 1,
          publishingCount: 0,
          failedCount: 0,
          cancelledCount: 0,
        },
        byProject: [
          {
            projectId: "p_1",
            projectName: "Acme",
            projectStatus: "ACTIVE",
            publishedCount: 2,
            removedCount: 0,
            totalScore: 20,
            totalComments: 5,
            scheduledCount: 1,
            failedCount: 0,
            avgScore: 10,
            avgComments: 2.5,
          },
        ],
      },
    );
  });

  test("persists deterministic daily rollup event", async () => {
    mockedPrisma.analyticsEvent.upsert.mockResolvedValueOnce({
      id: "rollup_ws_ws_1_2026-02-20",
      workspaceId: "ws_1",
      eventTs: new Date("2026-02-20T00:00:00.000Z"),
      properties: { some: "payload" },
    });

    const out = await persistWorkspaceDailyRollup({
      workspaceId: "ws_1",
      now: new Date("2026-02-20T08:00:00.000Z"),
    });

    expect(
      mockedDashboardSnapshot.computeWorkspaceDashboardSnapshot,
    ).toHaveBeenCalledWith("ws_1");
    expect(mockedPrisma.analyticsEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rollup_ws_ws_1_2026-02-20" },
      }),
    );
    expect(out.payload.workspaceId).toBe("ws_1");
    expect(out.payload.forDate).toBe("2026-02-20");
    expect(out.payload.summary.publishedCount).toBe(2);
  });

  test("runs rollups for advanced-analytics workspaces", async () => {
    mockedPrisma.workspace.findMany.mockResolvedValueOnce([
      { id: "ws_1" },
      { id: "ws_2" },
    ]);
    mockedPrisma.analyticsEvent.upsert
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_1_2026-02-20",
        workspaceId: "ws_1",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      })
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_2_2026-02-20",
        workspaceId: "ws_2",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      });

    const out = await runWorkspaceDailyRollups({
      now: new Date("2026-02-20T08:00:00.000Z"),
      maxWorkspaces: 10,
    });

    expect(mockedPrisma.workspace.findMany).toHaveBeenCalled();
    expect(mockedPrisma.analyticsEvent.upsert).toHaveBeenCalledTimes(2);
    expect(out).toEqual({
      forDate: "2026-02-20",
      scannedWorkspaces: 2,
      persisted: 2,
      failedWorkspaces: [],
    });
  });

  test("continues batch when one workspace rollup fails", async () => {
    mockedPrisma.workspace.findMany.mockResolvedValueOnce([
      { id: "ws_1" },
      { id: "ws_2" },
      { id: "ws_3" },
    ]);
    mockedPrisma.analyticsEvent.upsert
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_1_2026-02-20",
        workspaceId: "ws_1",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      })
      .mockRejectedValueOnce(new Error("db timeout"))
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_3_2026-02-20",
        workspaceId: "ws_3",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      });

    const out = await runWorkspaceDailyRollups({
      now: new Date("2026-02-20T08:00:00.000Z"),
      maxWorkspaces: 10,
    });

    expect(mockedPrisma.analyticsEvent.upsert).toHaveBeenCalledTimes(3);
    expect(out).toEqual({
      forDate: "2026-02-20",
      scannedWorkspaces: 3,
      persisted: 2,
      failedWorkspaces: [{ workspaceId: "ws_2", error: "db timeout" }],
    });
  });

  test("paginates workspace scan when page size is small", async () => {
    mockedPrisma.workspace.findMany
      .mockResolvedValueOnce([{ id: "ws_1" }, { id: "ws_2" }])
      .mockResolvedValueOnce([{ id: "ws_3" }])
      .mockResolvedValueOnce([]);
    mockedPrisma.analyticsEvent.upsert
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_1_2026-02-20",
        workspaceId: "ws_1",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      })
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_2_2026-02-20",
        workspaceId: "ws_2",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      })
      .mockResolvedValueOnce({
        id: "rollup_ws_ws_3_2026-02-20",
        workspaceId: "ws_3",
        eventTs: new Date("2026-02-20T00:00:00.000Z"),
        properties: {},
      });

    const out = await runWorkspaceDailyRollups({
      now: new Date("2026-02-20T08:00:00.000Z"),
      pageSize: 2,
    });

    expect(mockedPrisma.workspace.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: { id: "asc" },
        take: 2,
      }),
    );
    expect(mockedPrisma.workspace.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: { id: "asc" },
        take: 2,
        cursor: { id: "ws_2" },
        skip: 1,
      }),
    );
    expect(out).toEqual({
      forDate: "2026-02-20",
      scannedWorkspaces: 3,
      persisted: 3,
      failedWorkspaces: [],
    });
  });

  test("returns null when latest rollup payload is invalid", async () => {
    mockedPrisma.analyticsEvent.findFirst.mockResolvedValueOnce({
      id: "e_1",
      eventTs: new Date("2026-02-20T00:00:00.000Z"),
      ingestedAt: new Date("2026-02-20T08:00:00.000Z"),
      properties: { nope: true },
    });

    const out = await getLatestWorkspaceDailyRollup("ws_1");
    expect(out).toBeNull();
  });

  test("returns parsed latest rollup payload", async () => {
    mockedPrisma.analyticsEvent.findFirst.mockResolvedValueOnce({
      id: "e_1",
      eventTs: new Date("2026-02-20T00:00:00.000Z"),
      ingestedAt: new Date("2026-02-20T08:00:00.000Z"),
      properties: {
        workspaceId: "ws_1",
        forDate: "2026-02-20",
        generatedAt: "2026-02-20T08:00:00.000Z",
        summary: {
          projectCount: 1,
          publishedCount: 2,
          removedCount: 0,
          totalScore: 20,
          avgScore: 10,
          totalComments: 5,
          avgComments: 2.5,
          scheduledCount: 1,
          publishingCount: 0,
          failedCount: 0,
          cancelledCount: 0,
        },
        byProject: [],
      },
    });

    const out = await getLatestWorkspaceDailyRollup("ws_1");
    expect(out?.id).toBe("e_1");
    expect(out?.payload.workspaceId).toBe("ws_1");
    expect(out?.payload.forDate).toBe("2026-02-20");
  });
});
