jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    scheduledPost: { groupBy: jest.fn() },
    publishedItem: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/lib/analytics/trends", () => ({
  getProjectDailyPerformanceTrend: jest.fn(),
}));

import { computeProjectAnalyticsSnapshot } from "@/lib/analytics/projectSnapshot";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  scheduledPost: { groupBy: jest.Mock };
  publishedItem: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};
const mockedTrends = jest.requireMock("@/lib/analytics/trends") as {
  getProjectDailyPerformanceTrend: jest.Mock;
};

function buildPublishedItem(id: string, score: number) {
  return {
    id,
    type: "POST",
    permalink: `https://reddit.com/r/test/comments/${id}`,
    createdAt: new Date("2026-02-20T00:00:00.000Z"),
    subreddit: {
      id: "sub_1",
      name: "test",
      title: "Test",
    },
    snapshots: [
      {
        score,
        upvotes: score + 1,
        downvotes: 1,
        upvoteRatio: 0.9,
        numComments: score,
        isRemoved: false,
        removalReason: null,
        capturedAt: new Date("2026-02-20T00:10:00.000Z"),
      },
    ],
  };
}

describe("computeProjectAnalyticsSnapshot", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Project One",
      status: "ACTIVE",
    });
    mockedPrisma.scheduledPost.groupBy.mockResolvedValue([
      { status: "SCHEDULED", _count: { _all: 2 } },
      { status: "PUBLISHED", _count: { _all: 4 } },
    ]);
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        published_count: 4,
        total_score: 40,
        total_comments: 20,
        removed_count: 1,
        latest_captured_at: new Date("2026-02-20T00:10:00.000Z"),
      },
    ]);
    mockedTrends.getProjectDailyPerformanceTrend.mockResolvedValue([
      {
        day: "2026-02-20",
        totalScore: 40,
        totalComments: 20,
        removedCount: 1,
        activeItems: 4,
      },
    ]);
    mockedPrisma.publishedItem.findMany.mockResolvedValue([
      buildPublishedItem("pi_1", 12),
      buildPublishedItem("pi_2", 9),
    ]);
  });

  test("returns null when project is missing", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const out = await computeProjectAnalyticsSnapshot("ws_1", "missing");
    expect(out).toBeNull();
    expect(mockedPrisma.scheduledPost.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.publishedItem.findMany).not.toHaveBeenCalled();
  });

  test("limits returned items and exposes pagination cursor", async () => {
    mockedPrisma.publishedItem.findMany.mockResolvedValueOnce([
      buildPublishedItem("pi_1", 12),
      buildPublishedItem("pi_2", 11),
      buildPublishedItem("pi_3", 10),
    ]);

    const out = await computeProjectAnalyticsSnapshot("ws_1", "p_1", {
      itemLimit: 2,
    });

    expect(mockedPrisma.publishedItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
    expect(out?.items).toHaveLength(2);
    expect(out?.page).toEqual({
      limit: 2,
      hasMore: true,
      nextCursor: "pi_2",
    });
    expect(out?.trend).toHaveLength(1);
  });

  test("uses bounded max limit and cursor in item query", async () => {
    await computeProjectAnalyticsSnapshot("ws_1", "p_1", {
      itemLimit: 999,
      cursor: "pi_99",
    });

    expect(mockedPrisma.publishedItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 201,
        cursor: { id: "pi_99" },
        skip: 1,
      }),
    );
  });

  test("builds summary from aggregate query instead of visible page only", async () => {
    mockedPrisma.$queryRaw.mockResolvedValueOnce([
      {
        published_count: 25,
        total_score: 250,
        total_comments: 100,
        removed_count: 5,
        latest_captured_at: new Date("2026-02-19T12:00:00.000Z"),
      },
    ]);
    mockedPrisma.publishedItem.findMany.mockResolvedValueOnce([
      buildPublishedItem("pi_1", 10),
    ]);

    const out = await computeProjectAnalyticsSnapshot("ws_1", "p_1", {
      itemLimit: 1,
    });

    expect(out?.summary.publishedCount).toBe(25);
    expect(out?.summary.totalScore).toBe(250);
    expect(out?.summary.totalComments).toBe(100);
    expect(out?.summary.removedCount).toBe(5);
    expect(out?.summary.avgScore).toBe(10);
    expect(out?.summary.avgComments).toBe(4);
    expect(out?.trend).toHaveLength(1);
  });
});
