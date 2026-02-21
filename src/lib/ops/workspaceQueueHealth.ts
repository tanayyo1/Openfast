import { ScheduledStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const QUEUED_STATUSES: ScheduledStatus[] = ["SCHEDULED", "PENDING_APPROVAL"];

const ALL_STATUSES: ScheduledStatus[] = [
  "SCHEDULED",
  "PENDING_APPROVAL",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "CANCELLED",
];

const HEALTH_LEVELS = ["OK", "WARNING", "CRITICAL"] as const;

export type QueueHealthLevel = (typeof HEALTH_LEVELS)[number];

export type WorkspaceQueueHealthSnapshot = {
  generatedAt: string;
  level: QueueHealthLevel;
  reasons: string[];
  isIdle: boolean;
  counts: {
    scheduled: number;
    pendingApproval: number;
    queued: number;
    dueNow: number;
    overdue: number;
    publishing: number;
    stalePublishing: number;
    published: number;
    failedRetryable: number;
    failedPermanent: number;
    cancelled: number;
  };
  schedule: {
    nextRunAt: string | null;
    oldestDueAt: string | null;
  };
  thresholds: {
    overdueGraceMinutes: number;
    stalePublishingMinutes: number;
    criticalOverdueCount: number;
  };
};

type QueueHealthSignals = {
  overdueCount: number;
  stalePublishingCount: number;
  failedRetryableCount: number;
  failedPermanentCount: number;
  criticalOverdueCount: number;
  overdueGraceMinutes: number;
  stalePublishingMinutes: number;
};

function parsePositiveEnvInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function withSeverity(current: QueueHealthLevel, next: QueueHealthLevel) {
  return HEALTH_LEVELS.indexOf(next) > HEALTH_LEVELS.indexOf(current)
    ? next
    : current;
}

export function deriveQueueHealth(input: QueueHealthSignals): {
  level: QueueHealthLevel;
  reasons: string[];
} {
  let level: QueueHealthLevel = "OK";
  const reasons: string[] = [];

  if (input.stalePublishingCount > 0) {
    level = withSeverity(level, "CRITICAL");
    reasons.push(
      `${input.stalePublishingCount} ${pluralize(
        input.stalePublishingCount,
        "publishing item appears",
        "publishing items appear",
      )} stuck for more than ${input.stalePublishingMinutes} minutes.`,
    );
  }

  if (input.overdueCount > 0) {
    level = withSeverity(
      level,
      input.overdueCount >= input.criticalOverdueCount ? "CRITICAL" : "WARNING",
    );
    reasons.push(
      `${input.overdueCount} queued ${pluralize(
        input.overdueCount,
        "item is",
        "items are",
      )} overdue by at least ${input.overdueGraceMinutes} minutes.`,
    );
  }

  if (input.failedPermanentCount > 0) {
    level = withSeverity(
      level,
      input.failedPermanentCount >= 3 ? "CRITICAL" : "WARNING",
    );
    reasons.push(
      `${input.failedPermanentCount} ${pluralize(
        input.failedPermanentCount,
        "item has",
        "items have",
      )} permanent publish failures.`,
    );
  }

  if (input.failedRetryableCount > 0) {
    level = withSeverity(level, "WARNING");
    reasons.push(
      `${input.failedRetryableCount} ${pluralize(
        input.failedRetryableCount,
        "item is",
        "items are",
      )} in retryable failure state.`,
    );
  }

  return { level, reasons };
}

export async function getWorkspaceQueueHealthSnapshot(
  workspaceId: string,
): Promise<WorkspaceQueueHealthSnapshot> {
  const now = new Date();
  const overdueGraceMinutes = parsePositiveEnvInt(
    "SCHEDULING_QUEUE_OVERDUE_GRACE_MINUTES",
    15,
  );
  const stalePublishingMinutes = parsePositiveEnvInt(
    "SCHEDULING_STALE_PUBLISHING_MINUTES",
    30,
  );
  const criticalOverdueCount = parsePositiveEnvInt(
    "SCHEDULING_QUEUE_CRITICAL_OVERDUE_COUNT",
    5,
  );

  const overdueCutoff = new Date(now.getTime() - overdueGraceMinutes * 60_000);
  const stalePublishingCutoff = new Date(
    now.getTime() - stalePublishingMinutes * 60_000,
  );

  const [
    groupedStatuses,
    dueNowCount,
    overdueCount,
    stalePublishingCount,
    nextRun,
    oldestDue,
  ] = await Promise.all([
    prisma.scheduledPost.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.scheduledPost.count({
      where: {
        workspaceId,
        status: { in: QUEUED_STATUSES },
        scheduledAt: { lte: now },
      },
    }),
    prisma.scheduledPost.count({
      where: {
        workspaceId,
        status: { in: QUEUED_STATUSES },
        scheduledAt: { lte: overdueCutoff },
      },
    }),
    prisma.scheduledPost.count({
      where: {
        workspaceId,
        status: "PUBLISHING",
        updatedAt: { lte: stalePublishingCutoff },
      },
    }),
    prisma.scheduledPost.findFirst({
      where: {
        workspaceId,
        status: { in: QUEUED_STATUSES },
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      select: { scheduledAt: true },
    }),
    prisma.scheduledPost.findFirst({
      where: {
        workspaceId,
        status: { in: QUEUED_STATUSES },
        scheduledAt: { lte: now },
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      select: { scheduledAt: true },
    }),
  ]);

  const statusCounts = ALL_STATUSES.reduce<Record<ScheduledStatus, number>>(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<ScheduledStatus, number>,
  );

  for (const row of groupedStatuses) {
    statusCounts[row.status] = row._count._all;
  }

  const queuedCount = statusCounts.SCHEDULED + statusCounts.PENDING_APPROVAL;
  const publishingCount = statusCounts.PUBLISHING;
  const failedRetryableCount = statusCounts.FAILED_RETRYABLE;
  const failedPermanentCount = statusCounts.FAILED_PERMANENT;

  const derived = deriveQueueHealth({
    overdueCount,
    stalePublishingCount,
    failedRetryableCount,
    failedPermanentCount,
    criticalOverdueCount,
    overdueGraceMinutes,
    stalePublishingMinutes,
  });

  return {
    generatedAt: now.toISOString(),
    level: derived.level,
    reasons: derived.reasons,
    isIdle: queuedCount + publishingCount === 0,
    counts: {
      scheduled: statusCounts.SCHEDULED,
      pendingApproval: statusCounts.PENDING_APPROVAL,
      queued: queuedCount,
      dueNow: dueNowCount,
      overdue: overdueCount,
      publishing: publishingCount,
      stalePublishing: stalePublishingCount,
      published: statusCounts.PUBLISHED,
      failedRetryable: failedRetryableCount,
      failedPermanent: failedPermanentCount,
      cancelled: statusCounts.CANCELLED,
    },
    schedule: {
      nextRunAt: nextRun?.scheduledAt.toISOString() ?? null,
      oldestDueAt: oldestDue?.scheduledAt.toISOString() ?? null,
    },
    thresholds: {
      overdueGraceMinutes,
      stalePublishingMinutes,
      criticalOverdueCount,
    },
  };
}
