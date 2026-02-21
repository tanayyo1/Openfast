"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DraftStatus = "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";

type DraftListItem = {
  id: string;
  taskId: string | null;
  subredditId: string | null;
  type: "POST" | "COMMENT";
  title: string | null;
  body: string;
  status: DraftStatus;
  updatedAt: string;
};

type TaskDetail = {
  id: string;
  dayIndex: number;
  subredditId: string | null;
};

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<DraftListItem[]>([]);
  const [taskMeta, setTaskMeta] = useState<Record<string, TaskDetail>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const draftsRes = await fetch(
          "/api/drafts?status=REVIEWING&limit=100",
          {
            cache: "no-store",
          },
        );

        const draftsJson = (await draftsRes.json()) as
          | { items?: DraftListItem[]; error?: string }
          | undefined;

        if (!draftsRes.ok) {
          throw new Error(draftsJson?.error ?? "Failed to load approvals");
        }

        const items = draftsJson?.items ?? [];
        const taskIds = Array.from(
          new Set(
            items
              .map((item) => item.taskId)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const taskEntries = await Promise.all(
          taskIds.map(async (taskId) => {
            try {
              const taskRes = await fetch(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                {
                  cache: "no-store",
                },
              );
              if (!taskRes.ok) return [taskId, null] as const;
              const taskJson = (await taskRes.json()) as { task?: TaskDetail };
              return [taskId, taskJson.task ?? null] as const;
            } catch {
              return [taskId, null] as const;
            }
          }),
        );

        if (cancelled) return;

        setPending(items);
        setTaskMeta(
          Object.fromEntries(
            taskEntries.filter((entry): entry is [string, TaskDetail] =>
              Boolean(entry[1]),
            ),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load approvals";
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

  const sortedPending = useMemo(() => {
    return [...pending].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }, [pending]);

  async function approveDraft(draftId: string) {
    setActingId(draftId);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/drafts/${encodeURIComponent(draftId)}/approve`,
        {
          method: "POST",
        },
      );
      const json = (await res.json()) as { error?: string } | undefined;

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to approve draft");
      }

      setPending((current) => current.filter((item) => item.id !== draftId));
      setNotice("Draft approved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to approve draft";
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
            Approvals
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Draft approvals</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve drafts before they can be scheduled.
          </p>
        </div>
        <Link
          href="/scheduling/calendar"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Go to scheduling
        </Link>
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
          <p className="text-sm text-muted-foreground">Loading approvals...</p>
        </div>
      ) : sortedPending.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No approvals pending</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a draft from a task, then request approval.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/roadmaps"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              View roadmaps
            </Link>
            <Link
              href="/content"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              View drafts
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPending.map((draft) => {
            const task = draft.taskId ? taskMeta[draft.taskId] : undefined;
            return (
              <div
                key={draft.id}
                className="rounded-[24px] border border-border bg-card/80 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">
                      {draft.type.toLowerCase()} in{" "}
                      {task?.subredditId ?? draft.subredditId ?? "general"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {task
                        ? `Day ${task.dayIndex}`
                        : "Task details unavailable"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Draft:{" "}
                      {draft.title?.trim() ||
                        draft.body.slice(0, 80) ||
                        "Untitled"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/content/drafts/${encodeURIComponent(draft.id)}`}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                    >
                      Review draft
                    </Link>
                    <button
                      type="button"
                      disabled={actingId === draft.id}
                      onClick={() => {
                        void approveDraft(draft.id);
                      }}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {actingId === draft.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
