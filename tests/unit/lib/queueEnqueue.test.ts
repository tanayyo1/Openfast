jest.mock("@/lib/queue/queues", () => ({
  getPublishQueue: jest.fn(),
  getMetricsFetchQueue: jest.fn(),
  getRedditAdsSyncQueue: jest.fn(),
  getSubredditIngestQueue: jest.fn(),
  getSubredditComputeTimeWindowsQueue: jest.fn(),
}));

jest.mock("@/lib/queue/jobIds", () => ({
  publishJobId: jest.fn((id: string) => `publish:${id}`),
  metricsFetchJobId: jest.fn((id: string) => `metrics:${id}`),
  redditAdsSyncJobId: jest.fn(
    (input: { campaignId: string; status: string; version: string }) =>
      `reddit_ads_sync:${input.campaignId}:${input.status}:${input.version}`,
  ),
  subredditIngestJobId: jest.fn((name: string) => `subreddit_ingest:${name}`),
  subredditComputeTimeWindowsJobId: jest.fn(
    (id: string) => `subreddit_windows:${id}`,
  ),
}));

import {
  enqueueMetricsFetchJob,
  enqueuePublishJob,
  enqueueRedditAdsSyncJob,
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";

const mockedQueues = jest.requireMock("@/lib/queue/queues") as {
  getPublishQueue: jest.Mock;
  getMetricsFetchQueue: jest.Mock;
  getRedditAdsSyncQueue: jest.Mock;
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

  test("enqueueRedditAdsSyncJob uses deterministic jobId by default", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job3b" });
    mockedQueues.getRedditAdsSyncQueue.mockReturnValue({ add });

    await enqueueRedditAdsSyncJob({
      workspaceId: "ws_1",
      campaignId: "cmp_1",
      status: "ACTIVE",
      action: "UPSERT",
      trigger: "STATUS_CHANGE",
      version: "2026-02-21T00:00:00.000Z",
    });

    expect(add).toHaveBeenCalledWith(
      "reddit_ads_sync",
      {
        workspaceId: "ws_1",
        campaignId: "cmp_1",
        status: "ACTIVE",
        action: "UPSERT",
        trigger: "STATUS_CHANGE",
        version: "2026-02-21T00:00:00.000Z",
      },
      expect.objectContaining({
        jobId: "reddit_ads_sync:cmp_1:ACTIVE:2026-02-21T00:00:00.000Z",
      }),
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
