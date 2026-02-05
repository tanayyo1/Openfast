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

  return queue.add("publish", data, {
    jobId: publishJobId(data.scheduledPostId),
    ...opts,
  });
}

export async function enqueueMetricsFetchJob(
  data: MetricsFetchJobData,
  opts: JobsOptions = {},
) {
  const queue = getMetricsFetchQueue();

  return queue.add("metrics_fetch", data, {
    jobId: metricsFetchJobId(data.publishedItemId),
    ...opts,
  });
}
