jest.mock("@/lib/queue/queues", () => ({
  getPublishQueue: jest.fn(),
  getMetricsFetchQueue: jest.fn(),
}));

jest.mock("@/lib/queue/jobIds", () => ({
  publishJobId: jest.fn((id: string) => `publish:${id}`),
  metricsFetchJobId: jest.fn((id: string) => `metrics:${id}`),
}));

import { enqueueMetricsFetchJob, enqueuePublishJob } from "@/lib/queue/enqueue";

const mockedQueues = jest.requireMock("@/lib/queue/queues") as {
  getPublishQueue: jest.Mock;
  getMetricsFetchQueue: jest.Mock;
};

describe("enqueue helpers", () => {
  test("enqueuePublishJob uses deterministic jobId by default", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job1" });
    mockedQueues.getPublishQueue.mockReturnValue({ add });

    await enqueuePublishJob({ scheduledPostId: "sp_1" });

    expect(add).toHaveBeenCalledWith(
      "publish",
      { scheduledPostId: "sp_1" },
      expect.objectContaining({ jobId: "publish:sp_1" }),
    );
  });

  test("enqueuePublishJob allows explicit jobId override", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job2" });
    mockedQueues.getPublishQueue.mockReturnValue({ add });

    await enqueuePublishJob({ scheduledPostId: "sp_2" }, { jobId: "custom" });

    expect(add).toHaveBeenCalledWith(
      "publish",
      { scheduledPostId: "sp_2" },
      expect.objectContaining({ jobId: "custom" }),
    );
  });

  test("enqueueMetricsFetchJob uses deterministic jobId by default", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job3" });
    mockedQueues.getMetricsFetchQueue.mockReturnValue({ add });

    await enqueueMetricsFetchJob({ publishedItemId: "pi_1" });

    expect(add).toHaveBeenCalledWith(
      "metrics_fetch",
      { publishedItemId: "pi_1" },
      expect.objectContaining({ jobId: "metrics:pi_1" }),
    );
  });
});
