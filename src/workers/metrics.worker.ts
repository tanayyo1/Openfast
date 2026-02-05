import type { Job } from "bullmq";
import type { MetricsFetchJobData } from "@/lib/queue/enqueue";

export async function processMetricsFetchJob(job: Job<MetricsFetchJobData>) {
  // Stub worker: real Reddit metrics fetch is implemented in RED-37.
  if (!job.data.publishedItemId) {
    throw new Error("INVALID_JOB_DATA");
  }

  return {
    publishedItemId: job.data.publishedItemId,
    status: "stubbed",
  };
}
