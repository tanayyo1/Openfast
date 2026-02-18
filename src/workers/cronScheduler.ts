import { prisma } from "@/lib/prisma";
import {
  enqueueMetricsFetchJob,
  enqueueRiskAccountHealthJob,
  enqueueRoadmapGenerateJob,
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";
import { emitOpsAlert } from "@/lib/ops/alerts";
import {
  getPublishQueue,
  getContentGenerateQueue,
  getMetricsFetchQueue,
  getSubredditIngestQueue,
  getRecommendationsGenerateQueue,
  getRoadmapGenerateQueue,
  getDeadLetterQueue,
} from "@/lib/queue/queues";

function bucketTag(date: Date, minutes: number) {
  const ms = minutes * 60 * 1000;
  return String(Math.floor(date.getTime() / ms));
}

async function runDailyIngest(now: Date) {
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stale = await prisma.subredditCatalog.findMany({
    where: { lastFetchedAt: { lt: staleBefore } },
    select: { name: true },
    orderBy: { lastFetchedAt: "asc" },
    take: 200,
  });

  await Promise.all(
    stale.map((s) =>
      enqueueSubredditIngestJob(
        { subredditName: s.name },
        { jobId: `cron:ingest:${s.name}:${bucketTag(now, 24 * 60)}` },
      ).catch(() => undefined),
    ),
  );
}

async function runDailyTimeWindows(now: Date) {
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const subs = await prisma.subredditCatalog.findMany({
    where: {
      OR: [{ timeSlots: { none: {} } }, { lastFetchedAt: { lt: staleBefore } }],
    },
    select: { id: true },
    take: 200,
  });

  await Promise.all(
    subs.map((s) =>
      enqueueSubredditComputeTimeWindowsJob(
        { subredditId: s.id },
        { jobId: `cron:time_windows:${s.id}:${bucketTag(now, 24 * 60)}` },
      ).catch(() => undefined),
    ),
  );
}

async function runMetricsRefresh(now: Date) {
  const recent = await prisma.publishedItem.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const bucket = bucketTag(now, 30);
  await Promise.all(
    recent.map((item) =>
      enqueueMetricsFetchJob(
        { publishedItemId: item.id },
        { jobId: `cron:metrics:${item.id}:${bucket}` },
      ).catch(() => undefined),
    ),
  );
}

async function runDailyHealthAndReminders(now: Date) {
  const accounts = await prisma.redditAccount.findMany({
    where: { isActive: true },
    select: { id: true, workspaceId: true },
    take: 500,
  });

  await Promise.all(
    accounts.map((a) =>
      enqueueRiskAccountHealthJob(
        { workspaceId: a.workspaceId, redditAccountId: a.id },
        { jobId: `cron:health:${a.id}:${bucketTag(now, 24 * 60)}` },
      ).catch(() => undefined),
    ),
  );

  const activeRoadmaps = await prisma.roadmap.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, projectId: true, workspaceId: true },
    take: 200,
  });

  await Promise.all(
    activeRoadmaps.map((r) =>
      enqueueRoadmapGenerateJob(
        { workspaceId: r.workspaceId, projectId: r.projectId, roadmapId: r.id },
        {
          jobId: `cron:daily_reminder:${r.projectId}:${bucketTag(now, 24 * 60)}`,
        },
      ).catch(() => undefined),
    ),
  );
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function runBacklogCheck() {
  const backlogThreshold = parsePositiveInt(
    process.env.QUEUE_BACKLOG_ALERT_THRESHOLD,
    1000,
  );

  const queues = [
    { name: "reddit.publish", queue: getPublishQueue() },
    { name: "content.generate", queue: getContentGenerateQueue() },
    { name: "reddit.metrics_fetch", queue: getMetricsFetchQueue() },
    { name: "subreddit.ingest", queue: getSubredditIngestQueue() },
    {
      name: "recommendations.generate",
      queue: getRecommendationsGenerateQueue(),
    },
    { name: "roadmap.generate", queue: getRoadmapGenerateQueue() },
    { name: "dead.letter", queue: getDeadLetterQueue() },
  ];

  for (const { name, queue } of queues) {
    try {
      const counts = await queue.getJobCounts("waiting", "failed");
      if (counts.waiting >= backlogThreshold) {
        await emitOpsAlert({
          type: "queue.backlog",
          level: "warn",
          message: `Queue backlog threshold exceeded: ${name}`,
          details: { queue: name, waiting: counts.waiting, backlogThreshold },
        });
      }
      if (counts.failed >= 100) {
        await emitOpsAlert({
          type: "queue.failed_accumulation",
          level: "warn",
          message: `High failed job count: ${name}`,
          details: { queue: name, failed: counts.failed },
        });
      }
    } catch (err: unknown) {
      await emitOpsAlert({
        type: "queue.backlog_check_failed",
        level: "error",
        message: `Backlog check failed for queue: ${name}`,
        details: {
          queue: name,
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => undefined);
    }
  }
}

type CronState = {
  lastIngestDay: string | null;
  lastWindowsDay: string | null;
  lastReminderDay: string | null;
  lastMetricsBucket: string | null;
  lastBacklogBucket: string | null;
};

export function startCronScheduler() {
  const enabled =
    (process.env.ENABLE_MVP_CRON ?? "true").toLowerCase() !== "false";
  if (!enabled) return () => {};

  const state: CronState = {
    lastIngestDay: null,
    lastWindowsDay: null,
    lastReminderDay: null,
    lastMetricsBucket: null,
    lastBacklogBucket: null,
  };

  const tick = async () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const minute = now.getUTCMinutes();
    const hour = now.getUTCHours();
    const metricsBucket = `${day}:${hour}:${Math.floor(minute / 30)}`;

    if (state.lastMetricsBucket !== metricsBucket) {
      state.lastMetricsBucket = metricsBucket;
      await runMetricsRefresh(now);
    }

    if (hour === 1 && minute < 10 && state.lastIngestDay !== day) {
      state.lastIngestDay = day;
      await runDailyIngest(now);
    }

    if (hour === 2 && minute < 10 && state.lastWindowsDay !== day) {
      state.lastWindowsDay = day;
      await runDailyTimeWindows(now);
    }

    if (hour === 3 && minute < 10 && state.lastReminderDay !== day) {
      state.lastReminderDay = day;
      await runDailyHealthAndReminders(now);
    }

    // Check queue backlogs every 10 minutes.
    const backlogBucket = `${day}:${hour}:${Math.floor(minute / 10)}`;
    if (state.lastBacklogBucket !== backlogBucket) {
      state.lastBacklogBucket = backlogBucket;
      await runBacklogCheck();
    }
  };

  void tick().catch((err: unknown) =>
    emitOpsAlert({
      type: "cron.startup_failed",
      level: "error",
      message: "Cron scheduler initial run failed",
      details: { error: err instanceof Error ? err.message : String(err) },
    }),
  );

  const timer = setInterval(() => {
    void tick().catch((err: unknown) =>
      emitOpsAlert({
        type: "cron.tick_failed",
        level: "error",
        message: "Cron scheduler tick failed",
        details: { error: err instanceof Error ? err.message : String(err) },
      }),
    );
  }, 60 * 1000);

  return () => clearInterval(timer);
}
