import { Worker } from "bullmq";
import { requireRedis } from "@/lib/queue/connection";
import { QUEUE_NAMES } from "@/lib/queue/constants";
import { getDeadLetterQueue } from "@/lib/queue/queues";
import { processPublishJob } from "./publish.worker";
import { processMetricsFetchJob } from "./metrics.worker";
import { processContentGenerateJob } from "./content.worker";
import { processSubredditIngestJob } from "./subredditIngest.worker";
import { processSubredditComputeTimeWindowsJob } from "./subredditTimeWindows.worker";
import { processRiskAccountHealthJob } from "./riskAccountHealth.worker";
import { processRiskVisibilityCheckJob } from "./riskVisibilityCheck.worker";
import { processRecommendationsGenerateJob } from "./recommendations.worker";
import { processRoadmapGenerateJob } from "./roadmapGenerate.worker";
import { processRedditAdsSyncJob } from "./redditAdsSync.worker";
import { startCronScheduler } from "./cronScheduler";
import { emitOpsAlert } from "@/lib/ops/alerts";

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
  const contentConcurrency = parseWorkerConcurrency(
    "CONTENT_WORKER_CONCURRENCY",
    2,
  );
  const subredditIngestConcurrency = parseWorkerConcurrency(
    "SUBREDDIT_INGEST_WORKER_CONCURRENCY",
    1,
  );
  const subredditTimeWindowsConcurrency = parseWorkerConcurrency(
    "SUBREDDIT_TIME_WINDOWS_WORKER_CONCURRENCY",
    1,
  );
  const riskAccountHealthConcurrency = parseWorkerConcurrency(
    "RISK_ACCOUNT_HEALTH_WORKER_CONCURRENCY",
    1,
  );
  const riskVisibilityCheckConcurrency = parseWorkerConcurrency(
    "RISK_VISIBILITY_CHECK_WORKER_CONCURRENCY",
    1,
  );
  const recommendationsConcurrency = parseWorkerConcurrency(
    "RECOMMENDATIONS_WORKER_CONCURRENCY",
    1,
  );
  const roadmapGenerateConcurrency = parseWorkerConcurrency(
    "ROADMAP_GENERATE_WORKER_CONCURRENCY",
    1,
  );
  const redditAdsSyncConcurrency = parseWorkerConcurrency(
    "REDDIT_ADS_SYNC_WORKER_CONCURRENCY",
    1,
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

  const contentWorker = new Worker(
    QUEUE_NAMES.CONTENT_GENERATE,
    processContentGenerateJob,
    {
      connection,
      concurrency: contentConcurrency,
    },
  );
  const subredditIngestWorker = new Worker(
    QUEUE_NAMES.SUBREDDIT_INGEST,
    processSubredditIngestJob,
    {
      connection,
      concurrency: subredditIngestConcurrency,
    },
  );

  const subredditTimeWindowsWorker = new Worker(
    QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
    processSubredditComputeTimeWindowsJob,
    {
      connection,
      concurrency: subredditTimeWindowsConcurrency,
    },
  );
  const riskAccountHealthWorker = new Worker(
    QUEUE_NAMES.RISK_ACCOUNT_HEALTH,
    processRiskAccountHealthJob,
    {
      connection,
      concurrency: riskAccountHealthConcurrency,
    },
  );
  const riskVisibilityCheckWorker = new Worker(
    QUEUE_NAMES.RISK_VISIBILITY_CHECK,
    processRiskVisibilityCheckJob,
    {
      connection,
      concurrency: riskVisibilityCheckConcurrency,
    },
  );
  const recommendationsWorker = new Worker(
    QUEUE_NAMES.RECOMMENDATIONS_GENERATE,
    processRecommendationsGenerateJob,
    {
      connection,
      concurrency: recommendationsConcurrency,
    },
  );
  const roadmapGenerateWorker = new Worker(
    QUEUE_NAMES.ROADMAP_GENERATE,
    processRoadmapGenerateJob,
    {
      connection,
      concurrency: roadmapGenerateConcurrency,
    },
  );
  const redditAdsSyncWorker = new Worker(
    QUEUE_NAMES.REDDIT_ADS_SYNC,
    processRedditAdsSyncJob,
    {
      connection,
      concurrency: redditAdsSyncConcurrency,
    },
  );

  const dlq = getDeadLetterQueue();
  const stopCronScheduler = startCronScheduler();

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
    void emitOpsAlert({
      type: "publish.failed",
      level: "error",
      message: "Publish job failed",
      details: {
        queue: QUEUE_NAMES.REDDIT_PUBLISH,
        jobId: String(job.id),
        reason: err.message,
      },
    });
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
    void emitOpsAlert({
      type: "metrics.failed",
      level: "warn",
      message: "Metrics fetch job failed",
      details: {
        queue: QUEUE_NAMES.REDDIT_METRICS_FETCH,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });

  contentWorker.on("failed", (job, err) => {
    if (!job) return;
    if (!job.id) {
      console.warn(
        "Failed job missing id; skipping DLQ forward for queue:",
        QUEUE_NAMES.CONTENT_GENERATE,
      );
      return;
    }
    forwardToDlq(QUEUE_NAMES.CONTENT_GENERATE, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "content.failed",
      level: "error",
      message: "Content generation job failed",
      details: {
        queue: QUEUE_NAMES.CONTENT_GENERATE,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });

  subredditIngestWorker.on("failed", (job, err) => {
    if (!job) return;
    if (!job.id) {
      console.warn(
        "Failed job missing id; skipping DLQ forward for queue:",
        QUEUE_NAMES.SUBREDDIT_INGEST,
      );
      return;
    }
    forwardToDlq(QUEUE_NAMES.SUBREDDIT_INGEST, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "subreddit_ingest.failed",
      level: "warn",
      message: "Subreddit ingest job failed",
      details: {
        queue: QUEUE_NAMES.SUBREDDIT_INGEST,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });

  subredditTimeWindowsWorker.on("failed", (job, err) => {
    if (!job) return;
    if (!job.id) {
      console.warn(
        "Failed job missing id; skipping DLQ forward for queue:",
        QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
      );
      return;
    }
    forwardToDlq(
      QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
      job.id,
      err.message,
    ).catch((dlqErr) => console.error("DLQ forward failed:", dlqErr));
    void emitOpsAlert({
      type: "subreddit_time_windows.failed",
      level: "warn",
      message: "Subreddit time windows job failed",
      details: {
        queue: QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });
  riskAccountHealthWorker.on("failed", (job, err) => {
    if (!job?.id) return;
    forwardToDlq(QUEUE_NAMES.RISK_ACCOUNT_HEALTH, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "risk_account_health.failed",
      level: "warn",
      message: "Account health check job failed",
      details: {
        queue: QUEUE_NAMES.RISK_ACCOUNT_HEALTH,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });
  riskVisibilityCheckWorker.on("failed", (job, err) => {
    if (!job?.id) return;
    forwardToDlq(QUEUE_NAMES.RISK_VISIBILITY_CHECK, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "risk_visibility_check.failed",
      level: "warn",
      message: "Visibility check job failed",
      details: {
        queue: QUEUE_NAMES.RISK_VISIBILITY_CHECK,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });
  recommendationsWorker.on("failed", (job, err) => {
    if (!job?.id) return;
    forwardToDlq(
      QUEUE_NAMES.RECOMMENDATIONS_GENERATE,
      job.id,
      err.message,
    ).catch((dlqErr) => console.error("DLQ forward failed:", dlqErr));
    void emitOpsAlert({
      type: "recommendations.failed",
      level: "warn",
      message: "Recommendations generation job failed",
      details: {
        queue: QUEUE_NAMES.RECOMMENDATIONS_GENERATE,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });
  roadmapGenerateWorker.on("failed", (job, err) => {
    if (!job?.id) return;
    forwardToDlq(QUEUE_NAMES.ROADMAP_GENERATE, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "roadmap.failed",
      level: "warn",
      message: "Roadmap generation job failed",
      details: {
        queue: QUEUE_NAMES.ROADMAP_GENERATE,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });
  redditAdsSyncWorker.on("failed", (job, err) => {
    if (!job?.id) return;
    forwardToDlq(QUEUE_NAMES.REDDIT_ADS_SYNC, job.id, err.message).catch(
      (dlqErr) => console.error("DLQ forward failed:", dlqErr),
    );
    void emitOpsAlert({
      type: "reddit_ads_sync.failed",
      level: "warn",
      message: "Reddit ads sync job failed",
      details: {
        queue: QUEUE_NAMES.REDDIT_ADS_SYNC,
        jobId: String(job.id),
        reason: err.message,
      },
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Shutting down workers (${signal})...`);
    await Promise.allSettled([
      publishWorker.close(),
      metricsWorker.close(),
      contentWorker.close(),
      subredditIngestWorker.close(),
      subredditTimeWindowsWorker.close(),
      riskAccountHealthWorker.close(),
      riskVisibilityCheckWorker.close(),
      recommendationsWorker.close(),
      roadmapGenerateWorker.close(),
      redditAdsSyncWorker.close(),
      dlq.close(),
    ]);
    stopCronScheduler();
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
    contentWorker.waitUntilReady(),
    subredditIngestWorker.waitUntilReady(),
    subredditTimeWindowsWorker.waitUntilReady(),
    riskAccountHealthWorker.waitUntilReady(),
    riskVisibilityCheckWorker.waitUntilReady(),
    recommendationsWorker.waitUntilReady(),
    roadmapGenerateWorker.waitUntilReady(),
    redditAdsSyncWorker.waitUntilReady(),
  ]);
}

start().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
