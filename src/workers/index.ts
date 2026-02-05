import { Worker } from "bullmq";
import { requireRedis } from "@/lib/queue/connection";
import { QUEUE_NAMES } from "@/lib/queue/constants";
import { getDeadLetterQueue } from "@/lib/queue/queues";
import { processPublishJob } from "./publish.worker";
import { processMetricsFetchJob } from "./metrics.worker";

function parseWorkerConcurrency(envName: string, fallback: number) {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function start() {
  const connection = requireRedis();
  const publishConcurrency = parseWorkerConcurrency(
    "PUBLISH_WORKER_CONCURRENCY",
    2,
  );
  const metricsConcurrency = parseWorkerConcurrency(
    "METRICS_WORKER_CONCURRENCY",
    2,
  );

  const publishWorker = new Worker(
    QUEUE_NAMES.REDDIT_PUBLISH,
    processPublishJob,
    {
      connection,
      concurrency: publishConcurrency,
    },
  );

  const metricsWorker = new Worker(
    QUEUE_NAMES.REDDIT_METRICS_FETCH,
    processMetricsFetchJob,
    {
      connection,
      concurrency: metricsConcurrency,
    },
  );

  const dlq = getDeadLetterQueue();

  const forwardToDlq = async (queue: string, jobId: string, reason: string) => {
    await dlq.add(
      "dead_letter",
      {
        queue,
        jobId,
        reason,
        capturedAt: new Date().toISOString(),
      },
      {
        // One record per queue/job pair.
        jobId: `dlq:${queue}:${jobId}`,
        attempts: 1,
      },
    );
  };

  publishWorker.on("failed", (job, err) => {
    if (!job) return;
    // BullMQ emits "failed" after retry attempts are exhausted.
    if (!job.id) {
      console.warn(
        "Failed job missing id; skipping DLQ forward for queue:",
        QUEUE_NAMES.REDDIT_PUBLISH,
      );
      return;
    }
    forwardToDlq(QUEUE_NAMES.REDDIT_PUBLISH, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
  });

  metricsWorker.on("failed", (job, err) => {
    if (!job) return;
    if (!job.id) {
      console.warn(
        "Failed job missing id; skipping DLQ forward for queue:",
        QUEUE_NAMES.REDDIT_METRICS_FETCH,
      );
      return;
    }
    forwardToDlq(QUEUE_NAMES.REDDIT_METRICS_FETCH, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Shutting down workers (${signal})...`);
    await Promise.allSettled([
      publishWorker.close(),
      metricsWorker.close(),
      dlq.close(),
    ]);
  };

  process.once("SIGINT", () => {
    shutdown("SIGINT")
      .catch((err) => console.error("Shutdown failed:", err))
      .finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM")
      .catch((err) => console.error("Shutdown failed:", err))
      .finally(() => process.exit(0));
  });

  // Keep process alive.
  await Promise.all([
    publishWorker.waitUntilReady(),
    metricsWorker.waitUntilReady(),
  ]);
}

start().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
