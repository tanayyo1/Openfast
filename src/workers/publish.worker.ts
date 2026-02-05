import type { Job } from "bullmq";
import type { PublishJobData } from "@/lib/queue/enqueue";

export async function processPublishJob(job: Job<PublishJobData>) {
  // Stub worker: real Reddit publishing is implemented in RED-33/35.
  // Keep side-effects minimal so it can run locally without Reddit keys.
  if (!job.data.scheduledPostId) {
    throw new Error("INVALID_JOB_DATA");
  }

  return {
    scheduledPostId: job.data.scheduledPostId,
    status: "stubbed",
  };
}
