import { Worker } from "bullmq";
import { requireRedis } from "@/lib/queue/connection";
import { QUEUE_NAMES } from "@/lib/queue/constants";
import { getDeadLetterQueue } from "@/lib/queue/queues";
import { processPublishJob } from "./publish.worker";
import { processMetricsFetchJob } from "./metrics.worker";

async function start() {
  const connection = requireRedis();

  const publishWorker = new Worker(
    QUEUE_NAMES.REDDIT_PUBLISH,
    processPublishJob,
    {
      connection,
      concurrency: 2,
    },
  );

  const metricsWorker = new Worker(
    QUEUE_NAMES.REDDIT_METRICS_FETCH,
    processMetricsFetchJob,
    {
      connection,
      concurrency: 2,
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
    forwardToDlq(QUEUE_NAMES.REDDIT_PUBLISH, job.id ?? "", err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
  });

  metricsWorker.on("failed", (job, err) => {
    if (!job) return;
    forwardToDlq(
      QUEUE_NAMES.REDDIT_METRICS_FETCH,
      job.id ?? "",
      err.message,
    ).catch((dlqErr) => console.error("DLQ forward failed:", dlqErr));
  });

  // Keep process alive.
  await Promise.all([
    publishWorker.waitUntilReady(),
    metricsWorker.waitUntilReady(),
  ]);
}

start().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exitCode = 1;
});
