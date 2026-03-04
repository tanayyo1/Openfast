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
  draftId: string;
  scheduledAt: string;
  status: ScheduledStatus;
  attempts: number;
  lastError: string | null;
  publishedAt: string | null;
  draft: {
    id: string;
    title: string | null;
    type: "POST" | "COMMENT";
    status: "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  };
  redditAccount: {
    id: string;
    redditUsername: string;
  };
  subreddit: {
    id: string;
    name: string;
    title: string;
  };
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

type QueueHealthLoadResult = {
  health: QueueHealthSnapshot | null;
  error: string | null;
};

const CANCELLABLE = new Set<ScheduledStatus>([
  "SCHEDULED",
  "PENDING_APPROVAL",
  "FAILED_RETRYABLE",
]);

const DELETABLE = new Set<ScheduledStatus>([
  "SCHEDULED",
  "PENDING_APPROVAL",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "CANCELLED",
]);

function statusLabel(status: ScheduledStatus) {
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

export default function SchedulingQueuePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledPostItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [queueHealth, setQueueHealth] = useState<QueueHealthSnapshot | null>(
    null,
  );
  const [queueHealthError, setQueueHealthError] = useState<string | null>(null);

  async function fetchQueueHealthSnapshot(): Promise<QueueHealthLoadResult> {
    try {
      const res = await fetch("/api/scheduling/queue-health", {
        cache: "no-store",
      });
      const json = (await res.json()) as
        | { health?: QueueHealthSnapshot; error?: string }
        | undefined;
      if (!res.ok) {
        return {
          health: null,
          error: json?.error ?? "Queue health unavailable",
        };
      }
      return { health: json?.health ?? null, error: null };
    } catch {
      return { health: null, error: "Queue health unavailable" };
    }
  }

  async function refreshQueueHealth() {
    const healthResult = await fetchQueueHealthSnapshot();
    setQueueHealth(healthResult.health);
    setQueueHealthError(healthResult.error);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setQueueHealthError(null);

      try {
        const [queueRes, healthResult] = await Promise.all([
          fetch("/api/scheduled-posts?limit=1000", {
            cache: "no-store",
          }),
          fetchQueueHealthSnapshot(),
        ]);
        const queueJson = (await queueRes.json()) as
          | { items?: ScheduledPostItem[]; error?: string; hasMore?: boolean }
          | undefined;

        if (!queueRes.ok) {
          throw new Error(queueJson?.error ?? "Failed to load queue");
        }

        if (cancelled) return;
        setItems(queueJson?.items ?? []);
        setHasMore(Boolean(queueJson?.hasMore));
        setQueueHealth(healthResult.health);
        setQueueHealthError(healthResult.error);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load queue";
        setError(message);
        setHasMore(false);
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

  const sorted = useMemo(() => {
    return [...items].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt),
    );
  }, [items]);

  async function cancel(id: string) {
    if (actingId) return;

    setActingId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/scheduled-posts/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        },
      );
      const json = (await res.json()) as { error?: string } | undefined;
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to cancel scheduled post");
      }
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: "CANCELLED", lastError: null }
            : item,
        ),
      );
      setNotice("Scheduled post cancelled.");
      await refreshQueueHealth();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel scheduled post";
      setError(message);
    } finally {
      setActingId(null);
    }
  }

  async function remove(id: string) {
    if (actingId) return;

    setActingId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/scheduled-posts/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const json = (await res.json()) as { error?: string } | undefined;
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to delete scheduled post");
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setNotice("Scheduled post deleted.");
      await refreshQueueHealth();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete scheduled post";
      setError(message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track scheduled jobs and publishing history.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Calendar
          </Link>
          <Link
            href="/analytics"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Analytics
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {notice}
        </div>
      ) : null}

      {hasMore ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Showing first 1000 scheduled items. Apply filters in API views for
          full history.
        </div>
      ) : null}

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold">Queue health</p>
          {!loading && queueHealth ? (
            <p
              className={`text-sm font-semibold ${healthTextClass(queueHealth.level)}`}
            >
              {healthLabel(queueHealth.level)}
            </p>
          ) : null}
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Checking queue health...
          </p>
        ) : queueHealthError ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {queueHealthError}
          </p>
        ) : queueHealth ? (
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>
              Queued: {queueHealth.counts.queued} • Due now:{" "}
              {queueHealth.counts.dueNow} • Overdue:{" "}
              {queueHealth.counts.overdue}
            </p>
            <p>
              Publishing: {queueHealth.counts.publishing} • Stale publishing:{" "}
              {queueHealth.counts.stalePublishing}
            </p>
            <p>
              Failures: {queueHealth.counts.failedRetryable} retryable,{" "}
              {queueHealth.counts.failedPermanent} permanent
            </p>
            {queueHealth.schedule.nextRunAt ? (
              <p>
                Next run:{" "}
                {new Date(queueHealth.schedule.nextRunAt).toLocaleString()}
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

      {loading ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm text-muted-foreground">Loading queue...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No scheduled items</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve a draft and schedule it in the calendar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/scheduling/calendar"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open calendar
            </Link>
            <Link
              href="/approvals"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Approvals
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((item) => {
            const cancellable = CANCELLABLE.has(item.status);
            const deletable = DELETABLE.has(item.status);

            return (
              <div
                key={item.id}
                className="rounded-[24px] border border-border bg-card/80 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {item.draft.type.toLowerCase()} in r/{item.subreddit.name}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Draft: {item.draft.title?.trim() || "Untitled"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Account: u/{item.redditAccount.redditUsername}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Run at: {new Date(item.scheduledAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Status: {statusLabel(item.status)}
                    </p>
                    {item.publishedAt ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Published at:{" "}
                        {new Date(item.publishedAt).toLocaleString()}
                      </p>
                    ) : null}
                    {item.lastError ? (
                      <p className="mt-2 text-sm text-destructive">
                        Error: {item.lastError}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/content/drafts/${encodeURIComponent(item.draftId)}`}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                    >
                      Open draft
                    </Link>
                    {cancellable ? (
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => {
                          void cancel(item.id);
                        }}
                        className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        {actingId === item.id ? "Cancelling..." : "Cancel"}
                      </button>
                    ) : null}
                    {deletable ? (
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => {
                          void remove(item.id);
                        }}
                        className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        {actingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Failure handling</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Retryable failures can be cancelled or deleted after inspection.
          Published/publishing items are protected from destructive actions.
        </p>
      </div>
    </div>
  );
}
