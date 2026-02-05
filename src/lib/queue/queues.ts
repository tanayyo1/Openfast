import { Queue } from "bullmq";
import { requireRedis } from "./connection";
import { QUEUE_NAMES } from "./constants";

let publishQueue: Queue | null = null;
let metricsFetchQueue: Queue | null = null;
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

export function getDeadLetterQueue() {
  if (!deadLetterQueue) deadLetterQueue = createQueue(QUEUE_NAMES.DEAD_LETTER);
  return deadLetterQueue;
}
