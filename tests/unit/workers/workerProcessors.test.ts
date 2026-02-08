import type { Job } from "bullmq";
import { processPublishJob } from "@/workers/publish.worker";
import { processMetricsFetchJob } from "@/workers/metrics.worker";

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
