import { deriveQueueHealth } from "@/lib/ops/workspaceQueueHealth";

describe("workspace queue health derivation", () => {
  test("returns OK when no risk signals are present", () => {
    const result = deriveQueueHealth({
      overdueCount: 0,
      stalePublishingCount: 0,
      failedRetryableCount: 0,
      failedPermanentCount: 0,
      criticalOverdueCount: 5,
      overdueGraceMinutes: 15,
      stalePublishingMinutes: 30,
    });

    expect(result.level).toBe("OK");
    expect(result.reasons).toEqual([]);
  });

  test("marks warning for small overdue backlog", () => {
    const result = deriveQueueHealth({
      overdueCount: 2,
      stalePublishingCount: 0,
      failedRetryableCount: 0,
      failedPermanentCount: 0,
      criticalOverdueCount: 5,
      overdueGraceMinutes: 15,
      stalePublishingMinutes: 30,
    });

    expect(result.level).toBe("WARNING");
    expect(result.reasons[0]).toContain("2 queued items");
  });

  test("marks critical when overdue backlog passes threshold", () => {
    const result = deriveQueueHealth({
      overdueCount: 5,
      stalePublishingCount: 0,
      failedRetryableCount: 0,
      failedPermanentCount: 0,
      criticalOverdueCount: 5,
      overdueGraceMinutes: 15,
      stalePublishingMinutes: 30,
    });

    expect(result.level).toBe("CRITICAL");
    expect(result.reasons[0]).toContain("overdue");
  });

  test("prioritizes critical signals when multiple risks exist", () => {
    const result = deriveQueueHealth({
      overdueCount: 1,
      stalePublishingCount: 1,
      failedRetryableCount: 2,
      failedPermanentCount: 3,
      criticalOverdueCount: 10,
      overdueGraceMinutes: 15,
      stalePublishingMinutes: 30,
    });

    expect(result.level).toBe("CRITICAL");
    expect(result.reasons).toHaveLength(4);
    expect(result.reasons[0]).toContain("stuck");
  });
});
