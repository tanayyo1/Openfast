import { prisma } from "@/lib/prisma";
import {
  enqueueMetricsFetchJob,
  enqueueRiskAccountHealthJob,
  enqueueRoadmapGenerateJob,
  enqueueSubredditComputeTimeWindowsJob,
  enqueueSubredditIngestJob,
} from "@/lib/queue/enqueue";
import { emitOpsAlert } from "@/lib/ops/alerts";

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

type CronState = {
  lastIngestDay: string | null;
  lastWindowsDay: string | null;
  lastReminderDay: string | null;
  lastMetricsBucket: string | null;
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
