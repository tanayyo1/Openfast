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

function label(status: ScheduledStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}

export default function SchedulingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledPostItem[]>([]);
  const [approvedDrafts, setApprovedDrafts] = useState<number>(0);
  const [hasMoreScheduled, setHasMoreScheduled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [scheduledRes, draftsRes] = await Promise.all([
          fetch("/api/scheduled-posts?limit=1000", { cache: "no-store" }),
          fetch("/api/drafts?status=APPROVED&limit=100", { cache: "no-store" }),
        ]);

        const scheduledJson = (await scheduledRes.json()) as
          | { items?: ScheduledPostItem[]; error?: string; hasMore?: boolean }
          | undefined;
        const draftsJson = (await draftsRes.json()) as
          | { items?: DraftItem[]; error?: string }
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
        setHasMoreScheduled(Boolean(scheduledJson?.hasMore));
        setApprovedDrafts((draftsJson?.items ?? []).length);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load scheduling";
        setError(message);
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
        ) : hasMoreScheduled && !loading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Showing first 1000 scheduled items.
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
