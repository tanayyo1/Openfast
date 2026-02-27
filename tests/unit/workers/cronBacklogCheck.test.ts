jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/queue/enqueue", () => ({}));

const mockEmitOpsAlert = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/ops/alerts", () => ({
  emitOpsAlert: (...args: unknown[]) => mockEmitOpsAlert(...args),
}));

const mockGetJobCounts = jest.fn();
const mockQueue = { getJobCounts: mockGetJobCounts };
const mockGetPublishQueue = jest.fn(() => mockQueue);
const mockGetContentGenerateQueue = jest.fn(() => mockQueue);
const mockGetMetricsFetchQueue = jest.fn(() => mockQueue);
const mockGetSubredditIngestQueue = jest.fn(() => mockQueue);
const mockGetSubredditComputeTimeWindowsQueue = jest.fn(() => mockQueue);
const mockGetRecommendationsGenerateQueue = jest.fn(() => mockQueue);
const mockGetRoadmapGenerateQueue = jest.fn(() => mockQueue);
const mockGetRiskAccountHealthQueue = jest.fn(() => mockQueue);
const mockGetRiskVisibilityCheckQueue = jest.fn(() => mockQueue);
const mockGetDeadLetterQueue = jest.fn(() => mockQueue);

jest.mock("@/lib/queue/queues", () => ({
  getPublishQueue: () => mockGetPublishQueue(),
  getContentGenerateQueue: () => mockGetContentGenerateQueue(),
  getMetricsFetchQueue: () => mockGetMetricsFetchQueue(),
  getSubredditIngestQueue: () => mockGetSubredditIngestQueue(),
  getSubredditComputeTimeWindowsQueue: () =>
    mockGetSubredditComputeTimeWindowsQueue(),
  getRecommendationsGenerateQueue: () => mockGetRecommendationsGenerateQueue(),
  getRoadmapGenerateQueue: () => mockGetRoadmapGenerateQueue(),
  getRiskAccountHealthQueue: () => mockGetRiskAccountHealthQueue(),
  getRiskVisibilityCheckQueue: () => mockGetRiskVisibilityCheckQueue(),
  getDeadLetterQueue: () => mockGetDeadLetterQueue(),
}));

import { parsePositiveInt, runBacklogCheck } from "@/workers/cronScheduler";

describe("parsePositiveInt", () => {
  test("returns fallback for undefined", () => {
    expect(parsePositiveInt(undefined, 42)).toBe(42);
  });

  test("returns fallback for empty string", () => {
    expect(parsePositiveInt("", 42)).toBe(42);
  });

  test("returns fallback for NaN input", () => {
    expect(parsePositiveInt("abc", 42)).toBe(42);
  });

  test("returns fallback for zero", () => {
    expect(parsePositiveInt("0", 42)).toBe(42);
  });

  test("returns fallback for negative values", () => {
    expect(parsePositiveInt("-5", 42)).toBe(42);
  });

  test("returns fallback for Infinity", () => {
    expect(parsePositiveInt("Infinity", 42)).toBe(42);
  });

  test("parses valid positive integer", () => {
    expect(parsePositiveInt("500", 42)).toBe(500);
  });

  test("floors decimal values", () => {
    expect(parsePositiveInt("3.7", 42)).toBe(3);
  });
});

describe("runBacklogCheck", () => {
  const originalEnv = process.env.QUEUE_BACKLOG_ALERT_THRESHOLD;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QUEUE_BACKLOG_ALERT_THRESHOLD;
    mockGetPublishQueue.mockImplementation(() => mockQueue);
    mockGetContentGenerateQueue.mockImplementation(() => mockQueue);
    mockGetMetricsFetchQueue.mockImplementation(() => mockQueue);
    mockGetSubredditIngestQueue.mockImplementation(() => mockQueue);
    mockGetSubredditComputeTimeWindowsQueue.mockImplementation(() => mockQueue);
    mockGetRecommendationsGenerateQueue.mockImplementation(() => mockQueue);
    mockGetRoadmapGenerateQueue.mockImplementation(() => mockQueue);
    mockGetRiskAccountHealthQueue.mockImplementation(() => mockQueue);
    mockGetRiskVisibilityCheckQueue.mockImplementation(() => mockQueue);
    mockGetDeadLetterQueue.mockImplementation(() => mockQueue);
  });

  afterEach(() => {
    if (typeof originalEnv === "string") {
      process.env.QUEUE_BACKLOG_ALERT_THRESHOLD = originalEnv;
    } else {
      delete process.env.QUEUE_BACKLOG_ALERT_THRESHOLD;
    }
  });

  test("emits no alerts when counts are below thresholds", async () => {
    mockGetJobCounts.mockResolvedValue({ waiting: 0, failed: 0 });
    await runBacklogCheck();
    expect(mockEmitOpsAlert).not.toHaveBeenCalled();
  });

  test("emits backlog alert when waiting exceeds threshold", async () => {
    mockGetJobCounts.mockResolvedValue({ waiting: 1500, failed: 0 });
    await runBacklogCheck();

    const backlogCalls = mockEmitOpsAlert.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "queue.backlog",
    );
    // 10 queues all above threshold
    expect(backlogCalls.length).toBe(10);
    expect(backlogCalls[0][0]).toMatchObject({
      type: "queue.backlog",
      level: "warn",
    });
  });

  test("emits failed_accumulation alert when failed >= 100", async () => {
    mockGetJobCounts.mockResolvedValue({ waiting: 0, failed: 150 });
    await runBacklogCheck();

    const failedCalls = mockEmitOpsAlert.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === "queue.failed_accumulation",
    );
    expect(failedCalls.length).toBe(10);
    expect(failedCalls[0][0]).toMatchObject({
      type: "queue.failed_accumulation",
      level: "warn",
    });
  });

  test("respects custom threshold from env", async () => {
    process.env.QUEUE_BACKLOG_ALERT_THRESHOLD = "50";
    mockGetJobCounts.mockResolvedValue({ waiting: 60, failed: 0 });
    await runBacklogCheck();

    const backlogCalls = mockEmitOpsAlert.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "queue.backlog",
    );
    expect(backlogCalls.length).toBe(10);
    expect(backlogCalls[0][0].details.backlogThreshold).toBe(50);
  });

  test("falls back to 1000 for garbage env value", async () => {
    process.env.QUEUE_BACKLOG_ALERT_THRESHOLD = "not-a-number";
    mockGetJobCounts.mockResolvedValue({ waiting: 999, failed: 0 });
    await runBacklogCheck();
    // 999 < 1000 (fallback), no alerts
    expect(mockEmitOpsAlert).not.toHaveBeenCalled();
  });

  test("continues checking remaining queues when one throws", async () => {
    let callCount = 0;
    mockGetJobCounts.mockImplementation(() => {
      callCount += 1;
      if (callCount === 3) {
        return Promise.reject(new Error("Redis connection lost"));
      }
      return Promise.resolve({ waiting: 0, failed: 0 });
    });

    await runBacklogCheck();

    // Should have attempted all 10 queues
    expect(mockGetJobCounts).toHaveBeenCalledTimes(10);

    // Should emit one backlog_check_failed alert for the failing queue
    const failedChecks = mockEmitOpsAlert.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === "queue.backlog_check_failed",
    );
    expect(failedChecks.length).toBe(1);
    expect(failedChecks[0][0]).toMatchObject({
      type: "queue.backlog_check_failed",
      level: "error",
    });
    expect(failedChecks[0][0].details.error).toBe("Redis connection lost");
  });

  test("continues checks when queue getter throws before getJobCounts", async () => {
    mockGetJobCounts.mockResolvedValue({ waiting: 0, failed: 0 });
    mockGetRecommendationsGenerateQueue.mockImplementation(() => {
      throw new Error("REDIS_NOT_CONFIGURED");
    });

    await runBacklogCheck();

    // One queue getter failed, other 9 queues were queried successfully.
    expect(mockGetJobCounts).toHaveBeenCalledTimes(9);
    const failedChecks = mockEmitOpsAlert.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { type: string }).type === "queue.backlog_check_failed",
    );
    expect(failedChecks.length).toBe(1);
    expect(failedChecks[0][0].details.error).toBe("REDIS_NOT_CONFIGURED");
  });
});
