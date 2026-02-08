import type { JobsOptions } from "bullmq";
import {
  getMetricsFetchQueue,
  getPublishQueue,
  getSubredditComputeTimeWindowsQueue,
  getSubredditIngestQueue,
} from "./queues";
import {
  metricsFetchJobId,
  publishJobId,
  subredditComputeTimeWindowsJobId,
  subredditIngestJobId,
} from "./jobIds";

export type PublishJobData = {
  scheduledPostId: string;
};

export type MetricsFetchJobData = {
  publishedItemId: string;
};

export type SubredditIngestJobData = {
  subredditName: string;
};

export type SubredditComputeTimeWindowsJobData = {
  subredditId: string;
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

export async function enqueueSubredditIngestJob(
  data: SubredditIngestJobData,
  opts: JobsOptions = {},
) {
  const queue = getSubredditIngestQueue();
  const jobId = opts.jobId ?? subredditIngestJobId(data.subredditName);

  return queue.add("subreddit_ingest", data, {
    ...opts,
    jobId,
  });
}

export async function enqueueSubredditComputeTimeWindowsJob(
  data: SubredditComputeTimeWindowsJobData,
  opts: JobsOptions = {},
) {
  const queue = getSubredditComputeTimeWindowsQueue();
  const jobId =
    opts.jobId ?? subredditComputeTimeWindowsJobId(data.subredditId);

  return queue.add("subreddit_compute_time_windows", data, {
    ...opts,
    jobId,
  });
}
