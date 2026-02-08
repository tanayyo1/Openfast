jest.mock("@/lib/queue/queues", () => ({
  getPublishQueue: jest.fn(),
  getMetricsFetchQueue: jest.fn(),
  getSubredditIngestQueue: jest.fn(),
  getSubredditComputeTimeWindowsQueue: jest.fn(),
}));

jest.mock("@/lib/queue/jobIds", () => ({
  publishJobId: jest.fn((id: string) => `publish:${id}`),
  metricsFetchJobId: jest.fn((id: string) => `metrics:${id}`),
  subredditIngestJobId: jest.fn((name: string) => `subreddit_ingest:${name}`),
  subredditComputeTimeWindowsJobId: jest.fn(
    (id: string) => `subreddit_windows:${id}`,
  ),
}));

import {
  enqueueMetricsFetchJob,
  enqueuePublishJob,
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";

const mockedQueues = jest.requireMock("@/lib/queue/queues") as {
  getPublishQueue: jest.Mock;
  getMetricsFetchQueue: jest.Mock;
  getSubredditIngestQueue: jest.Mock;
  getSubredditComputeTimeWindowsQueue: jest.Mock;
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

  test("enqueueSubredditIngestJob uses deterministic jobId by default", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job4" });
    mockedQueues.getSubredditIngestQueue.mockReturnValue({ add });

    await enqueueSubredditIngestJob({ subredditName: "startups" });

    expect(add).toHaveBeenCalledWith(
      "subreddit_ingest",
      { subredditName: "startups" },
      expect.objectContaining({ jobId: "subreddit_ingest:startups" }),
    );
  });

  test("enqueueSubredditComputeTimeWindowsJob uses deterministic jobId by default", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job5" });
    mockedQueues.getSubredditComputeTimeWindowsQueue.mockReturnValue({ add });

    await enqueueSubredditComputeTimeWindowsJob({ subredditId: "sub_1" });

    expect(add).toHaveBeenCalledWith(
      "subreddit_compute_time_windows",
      { subredditId: "sub_1" },
      expect.objectContaining({ jobId: "subreddit_windows:sub_1" }),
    );
  });
});
