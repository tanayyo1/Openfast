"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScheduledStatus =
  | "SCHEDULED"
  | "PENDING_APPROVAL"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT"
  | "CANCELLED";

type ScheduledPostItem = {
  id: string;
  scheduledAt: string;
  status: ScheduledStatus;
};

type DraftItem = {
  id: string;
  status: "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";
};

type QueueHealthLevel = "OK" | "WARNING" | "CRITICAL";

type QueueHealthSnapshot = {
  generatedAt: string;
  level: QueueHealthLevel;
  reasons: string[];
  isIdle: boolean;
  counts: {
    queued: number;
    dueNow: number;
    overdue: number;
    publishing: number;
    stalePublishing: number;
    failedRetryable: number;
    failedPermanent: number;
  };
  schedule: {
    nextRunAt: string | null;
    oldestDueAt: string | null;
  };
};

function label(status: ScheduledStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}

function healthLabel(level: QueueHealthLevel) {
  if (level === "CRITICAL") return "Critical";
  if (level === "WARNING") return "Needs attention";
  return "Healthy";
}

function healthTextClass(level: QueueHealthLevel) {
  if (level === "CRITICAL") return "text-destructive";
  if (level === "WARNING") return "text-amber-600 dark:text-amber-400";
  return "text-green-700 dark:text-green-400";
}

export default function SchedulingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledPostItem[]>([]);
  const [approvedDrafts, setApprovedDrafts] = useState<number>(0);
  const [queueHealth, setQueueHealth] = useState<QueueHealthSnapshot | null>(
    null,
  );
  const [queueHealthError, setQueueHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setQueueHealthError(null);

      try {
        const [scheduledRes, draftsRes, healthRes] = await Promise.all([
          fetch("/api/scheduled-posts?limit=100", { cache: "no-store" }),
          fetch("/api/drafts?status=APPROVED&limit=100", { cache: "no-store" }),
          fetch("/api/scheduling/queue-health", { cache: "no-store" }),
        ]);

        const scheduledJson = (await scheduledRes.json()) as
          | { items?: ScheduledPostItem[]; error?: string }
          | undefined;
        const draftsJson = (await draftsRes.json()) as
          | { items?: DraftItem[]; error?: string }
          | undefined;
        const healthJson = (await healthRes.json()) as
          | { health?: QueueHealthSnapshot; error?: string }
          | undefined;

        if (!scheduledRes.ok) {
          throw new Error(scheduledJson?.error ?? "Failed to load scheduling");
        }
        if (!draftsRes.ok) {
          throw new Error(
            draftsJson?.error ?? "Failed to load approved drafts",
          );
        }

        if (cancelled) return;

        setItems(scheduledJson?.items ?? []);
        setApprovedDrafts((draftsJson?.items ?? []).length);
        if (healthRes.ok) {
          setQueueHealth(healthJson?.health ?? null);
        } else {
          setQueueHealth(null);
          setQueueHealthError(healthJson?.error ?? "Queue health unavailable");
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load scheduling";
        setError(message);
        setQueueHealth(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const byStatus = items.reduce<Record<ScheduledStatus, number>>(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {
        SCHEDULED: 0,
        PENDING_APPROVAL: 0,
        PUBLISHING: 0,
        PUBLISHED: 0,
        FAILED_RETRYABLE: 0,
        FAILED_PERMANENT: 0,
        CANCELLED: 0,
      },
    );

    const nextRun = [...items]
      .filter(
        (item) =>
          item.status === "SCHEDULED" || item.status === "PENDING_APPROVAL",
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

    return {
      queued: byStatus.SCHEDULED + byStatus.PENDING_APPROVAL,
      publishing: byStatus.PUBLISHING,
      published: byStatus.PUBLISHED,
      failed: byStatus.FAILED_RETRYABLE + byStatus.FAILED_PERMANENT,
      nextRun,
    };
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Queue and calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Schedule only after approval. Review upcoming posts and jobs.
          </p>
        </div>
        <Link
          href="/scheduling/calendar"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open calendar
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/scheduling/calendar"
          className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
        >
          <p className="text-sm font-semibold">Calendar view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Find best-time windows and schedule into open slots.
          </p>
        </Link>
        <Link
          href="/scheduling/queue"
          className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
        >
          <p className="text-sm font-semibold">Queue view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Track scheduled jobs, retries, and publishing history.
          </p>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: "Approved drafts", value: String(approvedDrafts) },
          { label: "Queued", value: String(summary.queued) },
          { label: "Publishing", value: String(summary.publishing) },
          { label: "Published", value: String(summary.published) },
          { label: "Failed", value: String(summary.failed) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-border bg-card/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {loading ? "..." : item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold">Queue health</p>
          {!loading && queueHealth ? (
            <p className={`text-sm font-semibold ${healthTextClass(queueHealth.level)}`}>
              {healthLabel(queueHealth.level)}
            </p>
          ) : null}
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Checking queue health...
          </p>
        ) : queueHealthError ? (
          <p className="mt-2 text-sm text-muted-foreground">{queueHealthError}</p>
        ) : queueHealth ? (
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>
              Queued: {queueHealth.counts.queued} • Due now:{" "}
              {queueHealth.counts.dueNow} • Overdue: {queueHealth.counts.overdue}
            </p>
            <p>
              Publishing: {queueHealth.counts.publishing} • Stale publishing:{" "}
              {queueHealth.counts.stalePublishing}
            </p>
            <p>
              Failures: {queueHealth.counts.failedRetryable} retryable,{" "}
              {queueHealth.counts.failedPermanent} permanent
            </p>
            {queueHealth.schedule.oldestDueAt ? (
              <p>
                Oldest overdue item:{" "}
                {new Date(queueHealth.schedule.oldestDueAt).toLocaleString()}
              </p>
            ) : null}
            {queueHealth.reasons.length > 0 ? (
              <p>{queueHealth.reasons[0]}</p>
            ) : queueHealth.isIdle ? (
              <p>Queue is idle right now.</p>
            ) : (
              <p>No worker-risk signals detected.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Safety reminder</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Posts must be approved before scheduling. If an account is new or
          health is low, scheduling can be blocked by safety guardrails.
        </p>
        {summary.nextRun ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Next run: {new Date(summary.nextRun.scheduledAt).toLocaleString()} (
            {label(summary.nextRun.status)})
          </p>
        ) : !loading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No upcoming scheduled items.
          </p>
        ) : null}
      </div>
    </div>
  );
}
