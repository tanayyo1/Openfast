"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DraftItem = {
  id: string;
  taskId: string | null;
  subredditId: string | null;
  type: "POST" | "COMMENT";
  title: string | null;
  body: string;
  status: "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";
};

type TaskItem = {
  id: string;
  dayIndex: number;
  type: string;
  subredditId: string | null;
};

type RedditAccount = {
  id: string;
  redditUsername: string;
  safetyTier: "NEW" | "WARM" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED";
};

type ScheduledPost = {
  id: string;
  draftId: string;
  status:
    | "SCHEDULED"
    | "PENDING_APPROVAL"
    | "PUBLISHING"
    | "PUBLISHED"
    | "FAILED_RETRYABLE"
    | "FAILED_PERMANENT"
    | "CANCELLED";
  scheduledAt: string;
};

type ScheduledPostsListResponse = {
  items?: ScheduledPost[];
  hasMore?: boolean;
  error?: string;
};

type ScheduleForm = {
  redditAccountId: string;
  scheduledAtLocal: string;
};

function defaultLocalScheduleTime() {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  now.setSeconds(0, 0);
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

function formatTaskType(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function statusLabel(status: ScheduledPost["status"]) {
  return status.toLowerCase().replaceAll("_", " ");
}

function draftIdsQueryParam(draftIds: string[]) {
  return draftIds.map((item) => encodeURIComponent(item)).join(",");
}

export default function SchedulingCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingDraftId, setActingDraftId] = useState<string | null>(null);

  const [approvedDrafts, setApprovedDrafts] = useState<DraftItem[]>([]);
  const [accounts, setAccounts] = useState<RedditAccount[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, TaskItem>>({});
  const [scheduledByDraft, setScheduledByDraft] = useState<
    Record<string, ScheduledPost>
  >({});
  const [forms, setForms] = useState<Record<string, ScheduleForm>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [draftsRes, accountsRes] = await Promise.all([
          fetch("/api/drafts?status=APPROVED&limit=100", { cache: "no-store" }),
          fetch("/api/reddit/accounts", { cache: "no-store" }),
        ]);

        const draftsJson = (await draftsRes.json()) as
          | { items?: DraftItem[]; error?: string }
          | undefined;
        const accountsJson = (await accountsRes.json()) as
          | { items?: RedditAccount[]; error?: string }
          | undefined;

        if (!draftsRes.ok) {
          throw new Error(
            draftsJson?.error ?? "Failed to load approved drafts",
          );
        }
        if (!accountsRes.ok) {
          throw new Error(
            accountsJson?.error ?? "Failed to load Reddit accounts",
          );
        }
        const nextDrafts = (draftsJson?.items ?? []).filter(
          (item) => item.status === "APPROVED",
        );

        const taskIds = Array.from(
          new Set(
            nextDrafts
              .map((item) => item.taskId)
              .filter((value): value is string => Boolean(value)),
          ),
        );
        const scheduledQuery =
          nextDrafts.length > 0
            ? `/api/scheduled-posts?limit=${Math.max(
                50,
                nextDrafts.length,
              )}&draftIds=${draftIdsQueryParam(nextDrafts.map((item) => item.id))}`
            : "/api/scheduled-posts?limit=1&draftIds=";
        const scheduledRes = await fetch(scheduledQuery, {
          cache: "no-store",
        });
        const scheduledJson = (await scheduledRes.json()) as
          | ScheduledPostsListResponse
          | undefined;
        if (!scheduledRes.ok) {
          throw new Error(
            scheduledJson?.error ?? "Failed to load scheduled posts",
          );
        }

        const tasks = await Promise.all(
          taskIds.map(async (taskId) => {
            try {
              const res = await fetch(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                {
                  cache: "no-store",
                },
              );
              if (!res.ok) return null;
              const json = (await res.json()) as { task?: TaskItem };
              return json.task ?? null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        const nextAccounts = accountsJson?.items ?? [];
        const defaultAccountId = nextAccounts[0]?.id ?? "";
        const defaultTime = defaultLocalScheduleTime();

        const nextScheduledMap = Object.fromEntries(
          (scheduledJson?.items ?? []).map((item) => [item.draftId, item]),
        );

        const nextForms: Record<string, ScheduleForm> = {};
        for (const draft of nextDrafts) {
          nextForms[draft.id] = {
            redditAccountId: defaultAccountId,
            scheduledAtLocal: defaultTime,
          };
        }

        setApprovedDrafts(nextDrafts);
        setAccounts(nextAccounts);
        setScheduledByDraft(nextScheduledMap);
        setForms(nextForms);
        setTaskMap(
          Object.fromEntries(
            tasks
              .filter((item): item is TaskItem => Boolean(item))
              .map((item) => [item.id, item]),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load scheduling data";
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

  const rows = useMemo(() => {
    return approvedDrafts.map((draft) => {
      const task = draft.taskId ? taskMap[draft.taskId] : undefined;
      const scheduled = scheduledByDraft[draft.id];
      return {
        draft,
        task,
        scheduled,
      };
    });
  }, [approvedDrafts, scheduledByDraft, taskMap]);

  function updateForm(draftId: string, patch: Partial<ScheduleForm>) {
    setForms((current) => ({
      ...current,
      [draftId]: {
        redditAccountId:
          current[draftId]?.redditAccountId ?? accounts[0]?.id ?? "",
        scheduledAtLocal:
          current[draftId]?.scheduledAtLocal ?? defaultLocalScheduleTime(),
        ...patch,
      },
    }));
  }

  async function scheduleDraft(draftId: string) {
    const form = forms[draftId];
    if (!form || actingDraftId) return;
    if (!form.redditAccountId) {
      setError("Connect a Reddit account before scheduling.");
      return;
    }

    const parsed = new Date(form.scheduledAtLocal);
    if (Number.isNaN(parsed.getTime())) {
      setError("Invalid schedule date/time.");
      return;
    }

    setActingDraftId(draftId);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          redditAccountId: form.redditAccountId,
          scheduledAt: parsed.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      const json = (await res.json()) as
        | {
            scheduledPost?: ScheduledPost;
            error?: string;
            details?: Record<string, unknown>;
            code?: string;
          }
        | undefined;

      if (!res.ok || !json?.scheduledPost) {
        if (json?.code === "ALREADY_SCHEDULED") {
          try {
            const lookupRes = await fetch(
              `/api/scheduled-posts?limit=1&draftIds=${encodeURIComponent(draftId)}`,
              { cache: "no-store" },
            );
            if (lookupRes.ok) {
              const lookupJson =
                (await lookupRes.json()) as ScheduledPostsListResponse;
              const existing = lookupJson.items?.[0];
              if (existing) {
                setScheduledByDraft((current) => ({
                  ...current,
                  [draftId]: existing,
                }));
              }
            }
          } catch {
            // Best effort hydration only.
          }
          setNotice("Draft is already scheduled.");
          return;
        }
        if (json?.code === "QUEUE_UNAVAILABLE" && json?.scheduledPost) {
          setScheduledByDraft((current) => ({
            ...current,
            [draftId]: json.scheduledPost as ScheduledPost,
          }));
          setError(
            json.error ??
              "Draft was saved, but queue is unavailable. Retry publish later from queue.",
          );
          return;
        }
        const details =
          json?.details && typeof json.details === "object"
            ? ` (${Object.entries(json.details)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(", ")})`
            : "";
        throw new Error((json?.error ?? "Failed to schedule draft") + details);
      }

      setScheduledByDraft((current) => ({
        ...current,
        [draftId]: json.scheduledPost as ScheduledPost,
      }));
      setNotice("Draft scheduled successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to schedule draft";
      setError(message);
    } finally {
      setActingDraftId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Schedule approved drafts into best-time windows.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/approvals"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Approvals
          </Link>
          <Link
            href="/scheduling/queue"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View queue
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

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Approved drafts</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a connected Reddit account and time window to schedule.
        </p>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-sm text-muted-foreground">
              Loading approved drafts...
            </p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-sm font-semibold">No Reddit account connected</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect a Reddit account to enable scheduling.
            </p>
            <div className="mt-4">
              <Link
                href="/onboarding/connect-reddit"
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Connect Reddit
              </Link>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-sm font-semibold">Nothing approved yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Request approval on a draft, approve it, then return here.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/content"
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Go to drafts
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
          <div className="mt-4 space-y-3">
            {rows.map(({ draft, task, scheduled }) => {
              const form = forms[draft.id];
              const disabled = Boolean(scheduled);
              return (
                <div
                  key={draft.id}
                  className="rounded-2xl border border-border bg-card/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">
                        {task
                          ? formatTaskType(task.type)
                          : draft.type.toLowerCase()}{" "}
                        in {task?.subredditId ?? draft.subredditId ?? "general"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Draft:{" "}
                        {draft.title?.trim() ||
                          draft.body.slice(0, 90) ||
                          "Untitled"}
                      </p>
                      {scheduled ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Scheduled:{" "}
                          {new Date(scheduled.scheduledAt).toLocaleString()} (
                          {statusLabel(scheduled.status)})
                        </p>
                      ) : null}
                    </div>
                    <div className="w-full max-w-xl space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">
                          <span className="mb-1 block text-xs text-muted-foreground">
                            Reddit account
                          </span>
                          <select
                            value={form?.redditAccountId ?? ""}
                            disabled={disabled}
                            onChange={(event) =>
                              updateForm(draft.id, {
                                redditAccountId: event.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
                          >
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                u/{account.redditUsername} (
                                {account.safetyTier.toLowerCase()})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-xs text-muted-foreground">
                            Schedule time
                          </span>
                          <input
                            type="datetime-local"
                            value={form?.scheduledAtLocal ?? ""}
                            disabled={disabled}
                            onChange={(event) =>
                              updateForm(draft.id, {
                                scheduledAtLocal: event.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/content/drafts/${encodeURIComponent(draft.id)}`}
                          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                        >
                          Review
                        </Link>
                        <button
                          type="button"
                          disabled={disabled || actingDraftId === draft.id}
                          onClick={() => {
                            void scheduleDraft(draft.id);
                          }}
                          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {scheduled
                            ? "Already scheduled"
                            : actingDraftId === draft.id
                              ? "Scheduling..."
                              : "Schedule"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Timezone and editing</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Rescheduling and timezone overrides are managed through queue actions
          in the current MVP.
        </p>
      </div>
    </div>
  );
}
