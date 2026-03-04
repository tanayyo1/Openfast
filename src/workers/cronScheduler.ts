import { prisma } from "@/lib/prisma";
import { runWorkspaceDailyRollups } from "@/lib/analytics/rollups";
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
  getSubredditComputeTimeWindowsQueue,
  getRecommendationsGenerateQueue,
  getRoadmapGenerateQueue,
  getRiskAccountHealthQueue,
  getRiskVisibilityCheckQueue,
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

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function runBacklogCheck() {
  const backlogThreshold = parsePositiveInt(
    process.env.QUEUE_BACKLOG_ALERT_THRESHOLD,
    1000,
  );

  const queueResolvers = [
    { name: "reddit.publish", getQueue: getPublishQueue },
    { name: "content.generate", getQueue: getContentGenerateQueue },
    { name: "reddit.metrics_fetch", getQueue: getMetricsFetchQueue },
    { name: "subreddit.ingest", getQueue: getSubredditIngestQueue },
    {
      name: "subreddit.compute_time_windows",
      getQueue: getSubredditComputeTimeWindowsQueue,
    },
    {
      name: "recommendations.generate",
      getQueue: getRecommendationsGenerateQueue,
    },
    { name: "roadmap.generate", getQueue: getRoadmapGenerateQueue },
    { name: "risk.account_health", getQueue: getRiskAccountHealthQueue },
    { name: "risk.visibility_check", getQueue: getRiskVisibilityCheckQueue },
    { name: "dead.letter", getQueue: getDeadLetterQueue },
  ];

  for (const { name, getQueue } of queueResolvers) {
    try {
      const queue = getQueue();
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

async function runCronTask(taskName: string, fn: () => Promise<void>) {
  try {
    await fn();
    return true;
  } catch (err: unknown) {
    await emitOpsAlert({
      type: "cron.task_failed",
      level: "error",
      message: `Cron task failed: ${taskName}`,
      details: {
        task: taskName,
        error: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => undefined);
    return false;
  }
}

type CronState = {
  lastIngestDay: string | null;
  lastWindowsDay: string | null;
  lastReminderDay: string | null;
  lastAnalyticsRollupDay: string | null;
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
    lastAnalyticsRollupDay: null,
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
      const ok = await runCronTask("metrics_refresh", () =>
        runMetricsRefresh(now),
      );
      if (ok) {
        state.lastMetricsBucket = metricsBucket;
      }
    }

    if (hour === 1 && minute < 10 && state.lastIngestDay !== day) {
      const ok = await runCronTask("daily_ingest", () => runDailyIngest(now));
      if (ok) {
        state.lastIngestDay = day;
      }
    }

    if (hour === 2 && minute < 10 && state.lastWindowsDay !== day) {
      const ok = await runCronTask("daily_time_windows", () =>
        runDailyTimeWindows(now),
      );
      if (ok) {
        state.lastWindowsDay = day;
      }
    }

    if (hour === 3 && minute < 10 && state.lastReminderDay !== day) {
      const ok = await runCronTask("daily_health_and_reminders", () =>
        runDailyHealthAndReminders(now),
      );
      if (ok) {
        state.lastReminderDay = day;
      }
    }

    if (hour === 4 && minute < 15 && state.lastAnalyticsRollupDay !== day) {
      const ok = await runCronTask("daily_analytics_rollups", async () => {
        const out = await runWorkspaceDailyRollups({ now });
        if (out.failedWorkspaces.length > 0) {
          const failedWorkspaceIds = out.failedWorkspaces.map(
            (failure) => failure.workspaceId,
          );
          await emitOpsAlert({
            type: "analytics.rollup_partial_failure",
            level: "warn",
            message:
              "Daily analytics rollups completed with workspace failures",
            details: {
              forDate: out.forDate,
              scannedWorkspaces: out.scannedWorkspaces,
              persisted: out.persisted,
              failedWorkspaceIds,
              failedWorkspaces: out.failedWorkspaces,
            },
          });
          throw new Error(
            `Workspace rollups failed for ${out.failedWorkspaces.length} of ${out.scannedWorkspaces} workspaces`,
          );
        }
      });
      if (ok) {
        state.lastAnalyticsRollupDay = day;
      }
    }

    // Check queue backlogs every 10 minutes.
    const backlogBucket = `${day}:${hour}:${Math.floor(minute / 10)}`;
    if (state.lastBacklogBucket !== backlogBucket) {
      const ok = await runCronTask("backlog_check", runBacklogCheck);
      if (ok) {
        state.lastBacklogBucket = backlogBucket;
      }
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
