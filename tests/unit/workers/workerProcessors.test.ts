import type { Job } from "bullmq";
import { processPublishJob } from "@/workers/publish.worker";
import { processMetricsFetchJob } from "@/workers/metrics.worker";

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
});
