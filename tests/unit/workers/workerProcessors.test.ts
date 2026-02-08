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

describe("worker processor input validation", () => {
  test("processPublishJob rejects missing scheduledPostId", async () => {
    const job = { data: {} } as unknown as Job<{ scheduledPostId: string }>;
    await expect(processPublishJob(job)).rejects.toThrow("INVALID_JOB_DATA");
  });

  test("processMetricsFetchJob rejects missing publishedItemId", async () => {
    const job = { data: {} } as unknown as Job<{ publishedItemId: string }>;
    await expect(processMetricsFetchJob(job)).rejects.toThrow(
      "INVALID_JOB_DATA",
    );
  });
});
