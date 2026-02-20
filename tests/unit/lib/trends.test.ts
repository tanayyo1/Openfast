jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import {
  clampTrendDays,
  getProjectDailyPerformanceTrend,
  getWorkspaceDailyPerformanceTrend,
} from "@/lib/analytics/trends";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  $queryRaw: jest.Mock;
};

describe("analytics trends", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        day: new Date("2026-02-18T00:00:00.000Z"),
        total_score: 5,
        total_comments: 3,
        removed_count: 1,
        active_items: 2,
      },
      {
        day: new Date("2026-02-19T00:00:00.000Z"),
        total_score: 12,
        total_comments: 7,
        removed_count: 0,
        active_items: 3,
      },
    ]);
  });

  test("clamps trend days into supported range", () => {
    expect(clampTrendDays(undefined)).toBe(14);
    expect(clampTrendDays(-1)).toBe(14);
    expect(clampTrendDays(1)).toBe(7);
    expect(clampTrendDays(120)).toBe(90);
    expect(clampTrendDays(21)).toBe(21);
  });

  test("maps workspace trend rows into response shape", async () => {
    const out = await getWorkspaceDailyPerformanceTrend("ws_1", {
      days: 20,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out).toEqual([
      {
        day: "2026-02-18",
        totalScore: 5,
        totalComments: 3,
        removedCount: 1,
        activeItems: 2,
      },
      {
        day: "2026-02-19",
        totalScore: 12,
        totalComments: 7,
        removedCount: 0,
        activeItems: 3,
      },
    ]);
  });

  test("maps project trend rows into response shape", async () => {
    const out = await getProjectDailyPerformanceTrend("ws_1", "p_1", {
      days: 14,
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(2);
    expect(out[0]?.day).toBe("2026-02-18");
    expect(out[1]?.totalComments).toBe(7);
  });
});
