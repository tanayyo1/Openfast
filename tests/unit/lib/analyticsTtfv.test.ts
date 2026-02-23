jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { getTimeToFirstValueMetrics } from "@/lib/analytics/funnel";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  $queryRaw: jest.Mock;
};

describe("getTimeToFirstValueMetrics", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("returns rounded minute metrics from SQL seconds output", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        sample_size: BigInt(3),
        avg_seconds: 240,
        p50_seconds: 180,
        p90_seconds: 420,
        min_seconds: 60,
        max_seconds: 600,
      },
    ]);

    const metrics = await getTimeToFirstValueMetrics(
      "ws_1",
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(metrics).toEqual({
      sampleSize: 3,
      avgMinutes: 4,
      p50Minutes: 3,
      p90Minutes: 7,
      minMinutes: 1,
      maxMinutes: 10,
    });
  });

  test("returns null minute fields when no valid samples exist", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        sample_size: BigInt(0),
        avg_seconds: null,
        p50_seconds: null,
        p90_seconds: null,
        min_seconds: null,
        max_seconds: null,
      },
    ]);

    const metrics = await getTimeToFirstValueMetrics(
      "ws_1",
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
    );

    expect(metrics).toEqual({
      sampleSize: 0,
      avgMinutes: null,
      p50Minutes: null,
      p90Minutes: null,
      minMinutes: null,
      maxMinutes: null,
    });
  });
});
