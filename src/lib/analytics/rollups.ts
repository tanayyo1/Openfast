import { Prisma } from "@prisma/client";
import {
  computeWorkspaceDashboardSnapshot,
  type WorkspaceDashboardSnapshot,
} from "@/lib/analytics/dashboardSnapshot";
import { prisma } from "@/lib/prisma";

export const WORKSPACE_DAILY_ROLLUP_EVENT =
  "analytics.rollup.workspace.daily";
const ROLLUP_SOURCE = "system.rollup";

export type WorkspaceDailyRollupPayload = WorkspaceDashboardSnapshot & {
  workspaceId: string;
  forDate: string;
  generatedAt: string;
};

export type WorkspaceDailyRollupFailure = {
  workspaceId: string;
  error: string;
};

export type WorkspaceDailyRollupRunResult = {
  forDate: string;
  scannedWorkspaces: number;
  persisted: number;
  failedWorkspaces: WorkspaceDailyRollupFailure[];
};

function dayKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayStartUtc(dayKey: string) {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

function stableRollupEventId(workspaceId: string, dayKey: string) {
  return `rollup_ws_${workspaceId}_${dayKey}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDashboardSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  return (
    isFiniteNumber(summary.projectCount) &&
    isFiniteNumber(summary.publishedCount) &&
    isFiniteNumber(summary.removedCount) &&
    isFiniteNumber(summary.totalScore) &&
    isFiniteNumber(summary.avgScore) &&
    isFiniteNumber(summary.totalComments) &&
    isFiniteNumber(summary.avgComments) &&
    isFiniteNumber(summary.scheduledCount) &&
    isFiniteNumber(summary.publishingCount) &&
    isFiniteNumber(summary.failedCount) &&
    isFiniteNumber(summary.cancelledCount)
  );
}

function isDashboardProjectMetric(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const metric = value as Record<string, unknown>;
  return (
    typeof metric.projectId === "string" &&
    typeof metric.projectName === "string" &&
    typeof metric.projectStatus === "string" &&
    isFiniteNumber(metric.publishedCount) &&
    isFiniteNumber(metric.removedCount) &&
    isFiniteNumber(metric.totalScore) &&
    isFiniteNumber(metric.totalComments) &&
    isFiniteNumber(metric.scheduledCount) &&
    isFiniteNumber(metric.failedCount) &&
    isFiniteNumber(metric.avgScore) &&
    isFiniteNumber(metric.avgComments)
  );
}

function isWorkspaceDailyRollupPayload(
  input: unknown,
): input is WorkspaceDailyRollupPayload {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  if (typeof value.workspaceId !== "string") return false;
  if (typeof value.forDate !== "string") return false;
  if (typeof value.generatedAt !== "string") return false;
  if (!isDashboardSummary(value.summary)) return false;
  if (!Array.isArray(value.byProject)) return false;
  if (!value.byProject.every((entry) => isDashboardProjectMetric(entry))) {
    return false;
  }
  return true;
}

export async function persistWorkspaceDailyRollup(input: {
  workspaceId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const forDate = dayKeyFromDate(now);
  const snapshot = await computeWorkspaceDashboardSnapshot(input.workspaceId);
  const payload: WorkspaceDailyRollupPayload = {
    workspaceId: input.workspaceId,
    forDate,
    generatedAt: now.toISOString(),
    ...snapshot,
  };

  const event = await prisma.analyticsEvent.upsert({
    where: {
      id: stableRollupEventId(input.workspaceId, forDate),
    },
    update: {
      eventName: WORKSPACE_DAILY_ROLLUP_EVENT,
      workspaceId: input.workspaceId,
      userId: null,
      anonymousSessionId: null,
      source: ROLLUP_SOURCE,
      page: null,
      properties: payload as unknown as Prisma.InputJsonValue,
      eventTs: dayStartUtc(forDate),
      ingestedAt: now,
    },
    create: {
      id: stableRollupEventId(input.workspaceId, forDate),
      eventName: WORKSPACE_DAILY_ROLLUP_EVENT,
      workspaceId: input.workspaceId,
      userId: null,
      anonymousSessionId: null,
      source: ROLLUP_SOURCE,
      page: null,
      properties: payload as unknown as Prisma.InputJsonValue,
      eventTs: dayStartUtc(forDate),
      ingestedAt: now,
    },
    select: {
      id: true,
      workspaceId: true,
      eventTs: true,
      properties: true,
    },
  });

  return {
    id: event.id,
    workspaceId: event.workspaceId,
    eventTs: event.eventTs,
    payload,
  };
}

export async function runWorkspaceDailyRollups(input?: {
  now?: Date;
  maxWorkspaces?: number;
  pageSize?: number;
}): Promise<WorkspaceDailyRollupRunResult> {
  const now = input?.now ?? new Date();
  const maxWorkspaces =
    typeof input?.maxWorkspaces === "number" &&
    Number.isFinite(input.maxWorkspaces) &&
    input.maxWorkspaces > 0
      ? Math.floor(input.maxWorkspaces)
      : null;
  const pageSize =
    typeof input?.pageSize === "number" &&
    Number.isFinite(input.pageSize) &&
    input.pageSize > 0
      ? Math.floor(input.pageSize)
      : 200;

  let scannedWorkspaces = 0;
  let persisted = 0;
  const failedWorkspaces: WorkspaceDailyRollupFailure[] = [];
  let cursorId: string | null = null;

  while (true) {
    const remaining = maxWorkspaces ? maxWorkspaces - scannedWorkspaces : null;
    if (remaining !== null && remaining <= 0) break;

    const take = remaining === null ? pageSize : Math.min(pageSize, remaining);
    const workspaces: Array<{ id: string }> = await prisma.workspace.findMany({
      where: {
        status: "ACTIVE",
        entitlements: {
          is: {
            hasAdvancedAnalytics: true,
          },
        },
      },
      orderBy: { id: "asc" },
      select: { id: true },
      take,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    });

    if (workspaces.length === 0) break;
    scannedWorkspaces += workspaces.length;

    for (const workspace of workspaces) {
      try {
        await persistWorkspaceDailyRollup({
          workspaceId: workspace.id,
          now,
        });
        persisted += 1;
      } catch (err: unknown) {
        failedWorkspaces.push({
          workspaceId: workspace.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    cursorId = workspaces[workspaces.length - 1]?.id ?? null;
  }

  return {
    forDate: dayKeyFromDate(now),
    scannedWorkspaces,
    persisted,
    failedWorkspaces,
  };
}

export async function getLatestWorkspaceDailyRollup(workspaceId: string) {
  const latest = await prisma.analyticsEvent.findFirst({
    where: {
      workspaceId,
      eventName: WORKSPACE_DAILY_ROLLUP_EVENT,
      source: ROLLUP_SOURCE,
    },
    orderBy: [{ eventTs: "desc" }, { ingestedAt: "desc" }],
    select: {
      id: true,
      eventTs: true,
      ingestedAt: true,
      properties: true,
    },
  });

  if (!latest || !isWorkspaceDailyRollupPayload(latest.properties)) {
    return null;
  }
  if (latest.properties.workspaceId !== workspaceId) {
    return null;
  }

  return {
    id: latest.id,
    eventTs: latest.eventTs,
    ingestedAt: latest.ingestedAt,
    payload: latest.properties,
  };
}
