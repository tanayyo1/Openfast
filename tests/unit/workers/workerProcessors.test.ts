import type { Job } from "bullmq";
import { processPublishJob } from "@/workers/publish.worker";
import { processMetricsFetchJob } from "@/workers/metrics.worker";
import { processSubredditIngestJob } from "@/workers/subredditIngest.worker";
import { processSubredditComputeTimeWindowsJob } from "@/workers/subredditTimeWindows.worker";

jest.mock("@/lib/subreddit/intel", () => ({
  ingestSubreddit: jest.fn(async (name: string) => ({ id: "sub_1", name })),
  computeSubredditTimeWindows: jest.fn(async (id: string) => ({
    subredditId: id,
    slotCount: 168,
    averageScore: 0.42,
  })),
}));

describe("worker processors (stubs)", () => {
  test("processPublishJob rejects missing scheduledPostId", async () => {
    const job = { data: {} } as unknown as Job<{ scheduledPostId: string }>;
    await expect(processPublishJob(job)).rejects.toThrow("INVALID_JOB_DATA");
  });

  test("processPublishJob returns stubbed result", async () => {
    const job = {
      data: { scheduledPostId: "sp_123" },
    } as unknown as Job<{ scheduledPostId: string }>;
    await expect(processPublishJob(job)).resolves.toEqual({
      scheduledPostId: "sp_123",
      status: "stubbed",
    });
  });

  test("processMetricsFetchJob rejects missing publishedItemId", async () => {
    const job = { data: {} } as unknown as Job<{ publishedItemId: string }>;
    await expect(processMetricsFetchJob(job)).rejects.toThrow(
      "INVALID_JOB_DATA",
    );
  });

  test("processMetricsFetchJob returns stubbed result", async () => {
    const job = {
      data: { publishedItemId: "pi_123" },
    } as unknown as Job<{ publishedItemId: string }>;
    await expect(processMetricsFetchJob(job)).resolves.toEqual({
      publishedItemId: "pi_123",
      status: "stubbed",
    });
  });

  test("processSubredditIngestJob rejects missing subredditName", async () => {
    const job = { data: {} } as unknown as Job<{ subredditName: string }>;
    await expect(processSubredditIngestJob(job)).rejects.toThrow(
      "INVALID_JOB_DATA",
    );
  });

  test("processSubredditIngestJob returns ingested result", async () => {
    const job = {
      data: { subredditName: "startups" },
    } as unknown as Job<{ subredditName: string }>;
    await expect(processSubredditIngestJob(job)).resolves.toEqual({
      subredditId: "sub_1",
      subredditName: "startups",
      status: "ingested",
    });
  });

  test("processSubredditComputeTimeWindowsJob rejects missing subredditId", async () => {
    const job = { data: {} } as unknown as Job<{ subredditId: string }>;
    await expect(processSubredditComputeTimeWindowsJob(job)).rejects.toThrow(
      "INVALID_JOB_DATA",
    );
  });

  test("processSubredditComputeTimeWindowsJob returns computed result", async () => {
    const job = {
      data: { subredditId: "sub_123" },
    } as unknown as Job<{ subredditId: string }>;
    await expect(processSubredditComputeTimeWindowsJob(job)).resolves.toEqual({
      subredditId: "sub_123",
      slotCount: 168,
      averageScore: 0.42,
      status: "computed",
    });
  });
});
