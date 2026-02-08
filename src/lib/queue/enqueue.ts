import type { JobsOptions } from "bullmq";
import {
  getContentGenerateQueue,
  getMetricsFetchQueue,
  getPublishQueue,
  getRecommendationsGenerateQueue,
  getRiskAccountHealthQueue,
  getRiskVisibilityCheckQueue,
  getRoadmapGenerateQueue,
  getSubredditComputeTimeWindowsQueue,
  getSubredditIngestQueue,
} from "./queues";
import {
  contentGenerateJobId,
  metricsFetchJobId,
  publishJobId,
  recommendationsGenerateJobId,
  riskAccountHealthJobId,
  riskVisibilityCheckJobId,
  roadmapGenerateJobId,
  subredditComputeTimeWindowsJobId,
  subredditIngestJobId,
} from "./jobIds";

export type PublishJobData = {
  scheduledPostId: string;
};

export type MetricsFetchJobData = {
  publishedItemId: string;
};

export type ContentGenerateMode = "GENERATE" | "REWRITE" | "COMPLIANCE";

export type ContentGenerateJobData = {
  workspaceId: string;
  taskId: string;
  draftId: string;
  mode: ContentGenerateMode;
  variantCount: number;
  tone?: string | null;
  length?: "short" | "medium" | "long" | null;
  sourceDraftId?: string | null;
};

export type SubredditIngestJobData = {
  subredditName: string;
};

export type SubredditComputeTimeWindowsJobData = {
  subredditId: string;
};

export type RecommendationsGenerateJobData = {
  workspaceId: string;
  projectId: string;
};

export type RoadmapGenerateJobData = {
  workspaceId: string;
  projectId: string;
  roadmapId?: string | null;
};

export type RiskAccountHealthJobData = {
  workspaceId: string;
  redditAccountId: string;
};

export type RiskVisibilityCheckJobData = {
  workspaceId: string;
  redditAccountId: string;
  publishedItemId?: string | null;
  permalink?: string | null;
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

export async function enqueueContentGenerateJob(
  data: ContentGenerateJobData,
  opts: JobsOptions = {},
) {
  const queue = getContentGenerateQueue();
  const jobId = opts.jobId ?? contentGenerateJobId(data.draftId);

  return queue.add("content_generate", data, {
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

export async function enqueueRecommendationsGenerateJob(
  data: RecommendationsGenerateJobData,
  opts: JobsOptions = {},
) {
  const queue = getRecommendationsGenerateQueue();
  const jobId = opts.jobId ?? recommendationsGenerateJobId(data.projectId);
  return queue.add("recommendations_generate", data, { ...opts, jobId });
}

export async function enqueueRoadmapGenerateJob(
  data: RoadmapGenerateJobData,
  opts: JobsOptions = {},
) {
  const queue = getRoadmapGenerateQueue();
  const jobId = opts.jobId ?? roadmapGenerateJobId(data.projectId);
  return queue.add("roadmap_generate", data, { ...opts, jobId });
}

export async function enqueueRiskAccountHealthJob(
  data: RiskAccountHealthJobData,
  opts: JobsOptions = {},
) {
  const queue = getRiskAccountHealthQueue();
  const jobId = opts.jobId ?? riskAccountHealthJobId(data.redditAccountId);
  return queue.add("risk_account_health", data, { ...opts, jobId });
}

export async function enqueueRiskVisibilityCheckJob(
  data: RiskVisibilityCheckJobData,
  opts: JobsOptions = {},
) {
  const queue = getRiskVisibilityCheckQueue();
  const jobId =
    opts.jobId ??
    riskVisibilityCheckJobId({
      redditAccountId: data.redditAccountId,
      publishedItemId: data.publishedItemId ?? null,
    });
  return queue.add("risk_visibility_check", data, { ...opts, jobId });
}
