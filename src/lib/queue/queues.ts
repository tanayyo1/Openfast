import { Queue } from "bullmq";
import { requireRedis } from "./connection";
import { QUEUE_NAMES } from "./constants";

let publishQueue: Queue | null = null;
let metricsFetchQueue: Queue | null = null;
let contentGenerateQueue: Queue | null = null;
let subredditIngestQueue: Queue | null = null;
let subredditComputeTimeWindowsQueue: Queue | null = null;
let recommendationsGenerateQueue: Queue | null = null;
let roadmapGenerateQueue: Queue | null = null;
let riskAccountHealthQueue: Queue | null = null;
let riskVisibilityCheckQueue: Queue | null = null;
let deadLetterQueue: Queue | null = null;

function createQueue(name: string) {
  // BullMQ accepts an ioredis connection instance.
  return new Queue(name, {
    connection: requireRedis(),
    defaultJobOptions: {
      // Keep retries conservative; callers may override.
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      // Avoid unbounded Redis growth in queue metadata. These defaults are a
      // debugging-oriented compromise and can be overridden per job.
      removeOnComplete: { count: 1_000 },
      // We keep a larger window of failed jobs for quick inspection even
      // though terminal failures are also forwarded to the DLQ.
      removeOnFail: { count: 10_000 },
    },
  });
}

export function getPublishQueue() {
  if (!publishQueue) publishQueue = createQueue(QUEUE_NAMES.REDDIT_PUBLISH);
  return publishQueue;
}

export function getMetricsFetchQueue() {
  if (!metricsFetchQueue)
    metricsFetchQueue = createQueue(QUEUE_NAMES.REDDIT_METRICS_FETCH);
  return metricsFetchQueue;
}

export function getContentGenerateQueue() {
  if (!contentGenerateQueue)
    contentGenerateQueue = createQueue(QUEUE_NAMES.CONTENT_GENERATE);
  return contentGenerateQueue;
}

export function getSubredditIngestQueue() {
  if (!subredditIngestQueue)
    subredditIngestQueue = createQueue(QUEUE_NAMES.SUBREDDIT_INGEST);
  return subredditIngestQueue;
}

export function getSubredditComputeTimeWindowsQueue() {
  if (!subredditComputeTimeWindowsQueue) {
    subredditComputeTimeWindowsQueue = createQueue(
      QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
    );
  }
  return subredditComputeTimeWindowsQueue;
}

export function getRecommendationsGenerateQueue() {
  if (!recommendationsGenerateQueue) {
    recommendationsGenerateQueue = createQueue(
      QUEUE_NAMES.RECOMMENDATIONS_GENERATE,
    );
  }
  return recommendationsGenerateQueue;
}

export function getRoadmapGenerateQueue() {
  if (!roadmapGenerateQueue) {
    roadmapGenerateQueue = createQueue(QUEUE_NAMES.ROADMAP_GENERATE);
  }
  return roadmapGenerateQueue;
}

export function getRiskAccountHealthQueue() {
  if (!riskAccountHealthQueue) {
    riskAccountHealthQueue = createQueue(QUEUE_NAMES.RISK_ACCOUNT_HEALTH);
  }
  return riskAccountHealthQueue;
}

export function getRiskVisibilityCheckQueue() {
  if (!riskVisibilityCheckQueue) {
    riskVisibilityCheckQueue = createQueue(QUEUE_NAMES.RISK_VISIBILITY_CHECK);
  }
  return riskVisibilityCheckQueue;
}

export function getDeadLetterQueue() {
  if (!deadLetterQueue) deadLetterQueue = createQueue(QUEUE_NAMES.DEAD_LETTER);
  return deadLetterQueue;
}

export async function closeAllQueues() {
  const queues = [
    publishQueue,
    metricsFetchQueue,
    contentGenerateQueue,
    subredditIngestQueue,
    subredditComputeTimeWindowsQueue,
    recommendationsGenerateQueue,
    roadmapGenerateQueue,
    riskAccountHealthQueue,
    riskVisibilityCheckQueue,
    deadLetterQueue,
  ].filter((q): q is Queue => q !== null);

  publishQueue = null;
  metricsFetchQueue = null;
  contentGenerateQueue = null;
  subredditIngestQueue = null;
  subredditComputeTimeWindowsQueue = null;
  recommendationsGenerateQueue = null;
  roadmapGenerateQueue = null;
  riskAccountHealthQueue = null;
  riskVisibilityCheckQueue = null;
  deadLetterQueue = null;

  await Promise.allSettled(queues.map((queue) => queue.close()));
}
