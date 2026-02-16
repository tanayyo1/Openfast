import type { Job } from "bullmq";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    redditAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    performanceSnapshot: {
      findMany: jest.fn(),
    },
    accountHealthSnapshot: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { processRiskAccountHealthJob } from "@/workers/riskAccountHealth.worker";

const mockedPrisma = prisma as unknown as {
  redditAccount: { findFirst: jest.Mock; update: jest.Mock };
  performanceSnapshot: { findMany: jest.Mock };
  accountHealthSnapshot: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe("risk account health worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops),
    );
  });

  test("creates snapshot and updates safety tier to restricted on high removals", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      linkKarma: 250,
      commentKarma: 300,
      safetyTier: "ESTABLISHED",
    });
    mockedPrisma.performanceSnapshot.findMany.mockResolvedValue([
      { isRemoved: true, score: 1, numComments: 0, capturedAt: new Date() },
      { isRemoved: true, score: 0, numComments: 0, capturedAt: new Date() },
      { isRemoved: true, score: 2, numComments: 1, capturedAt: new Date() },
      { isRemoved: false, score: 1, numComments: 0, capturedAt: new Date() },
      { isRemoved: true, score: -1, numComments: 0, capturedAt: new Date() },
    ]);
    mockedPrisma.accountHealthSnapshot.create.mockResolvedValue({ id: "hs_1" });
    mockedPrisma.redditAccount.update.mockResolvedValue({ id: "ra_1" });

    const out = await processRiskAccountHealthJob({
      data: { workspaceId: "ws_1", redditAccountId: "ra_1" },
    } as Job<{ workspaceId: string; redditAccountId: string }>);

    expect(out.status).toBe("captured");
    expect(out.safetyTier).toBe("RESTRICTED");
    expect(out.previousSafetyTier).toBe("ESTABLISHED");
    expect(mockedPrisma.accountHealthSnapshot.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.redditAccount.update).toHaveBeenCalledWith({
      where: { id: "ra_1" },
      data: { safetyTier: "RESTRICTED" },
    });
  });

  test("promotes to trusted when health is strong and karma is high", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_2",
      linkKarma: 700,
      commentKarma: 600,
      safetyTier: "ESTABLISHED",
    });
    mockedPrisma.performanceSnapshot.findMany.mockResolvedValue([
      { isRemoved: false, score: 20, numComments: 8, capturedAt: new Date() },
      { isRemoved: false, score: 12, numComments: 5, capturedAt: new Date() },
      { isRemoved: false, score: 9, numComments: 4, capturedAt: new Date() },
    ]);
    mockedPrisma.accountHealthSnapshot.create.mockResolvedValue({ id: "hs_2" });
    mockedPrisma.redditAccount.update.mockResolvedValue({ id: "ra_2" });

    const out = await processRiskAccountHealthJob({
      data: { workspaceId: "ws_1", redditAccountId: "ra_2" },
    } as Job<{ workspaceId: string; redditAccountId: string }>);

    expect(out.status).toBe("captured");
    expect(out.safetyTier).toBe("TRUSTED");
    expect(out.healthScore).toBeGreaterThanOrEqual(75);
  });

  test("throws when account is missing", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue(null);

    await expect(
      processRiskAccountHealthJob({
        data: { workspaceId: "ws_1", redditAccountId: "missing" },
      } as Job<{ workspaceId: string; redditAccountId: string }>),
    ).rejects.toThrow("REDDIT_ACCOUNT_NOT_FOUND");
  });
});
