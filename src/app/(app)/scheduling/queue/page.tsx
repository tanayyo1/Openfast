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

export default function SchedulingQueuePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledPostItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scheduled-posts?limit=100", {
        cache: "no-store",
      });
      const json = (await res.json()) as
        | { items?: ScheduledPostItem[]; error?: string }
        | undefined;

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load queue");
      }

      setItems(json?.items ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load queue";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
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
