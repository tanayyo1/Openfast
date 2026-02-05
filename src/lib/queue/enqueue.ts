import type { JobsOptions } from "bullmq";
import { getMetricsFetchQueue, getPublishQueue } from "./queues";
import { metricsFetchJobId, publishJobId } from "./jobIds";

export type PublishJobData = {
  scheduledPostId: string;
};

export type MetricsFetchJobData = {
  publishedItemId: string;
};

export async function enqueuePublishJob(
  data: PublishJobData,
  opts: JobsOptions = {},
) {
  const queue = getPublishQueue();

  // Default to deterministic IDs for idempotency; callers can override via
  // opts.jobId if they intentionally want multiple jobs per scheduled post.
  const jobId = opts.jobId ?? publishJobId(data.scheduledPostId);

  return queue.add("publish", data, {
    ...opts,
    jobId,
  });
}

export async function enqueueMetricsFetchJob(
  data: MetricsFetchJobData,
  opts: JobsOptions = {},
) {
  const queue = getMetricsFetchQueue();

  const jobId = opts.jobId ?? metricsFetchJobId(data.publishedItemId);

  return queue.add("metrics_fetch", data, {
    ...opts,
    jobId,
  });
}
