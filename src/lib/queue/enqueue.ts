import { JobsOptions, Queue } from "bullmq";
import { getRedis } from "@/lib/redis";

export type PublishJobData = {
  scheduledPostId: string;
};

let publishQueueSingleton: Queue<PublishJobData> | null = null;

function getPublishQueue(): Queue<PublishJobData> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not configured");
  }

  if (!publishQueueSingleton) {
    publishQueueSingleton = new Queue<PublishJobData>("reddit.publish", {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    });
  }

  return publishQueueSingleton;
}

export async function enqueuePublishJob(
  data: PublishJobData,
  opts: JobsOptions = {},
) {
  const queue = getPublishQueue();

  // Deterministic idempotency: one publish job per scheduled post.
  const jobId = opts.jobId ?? `publish:${data.scheduledPostId}`;

  return queue.add("publish", data, { ...opts, jobId });
}
