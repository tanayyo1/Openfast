"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TaskDetail = {
  id: string;
  roadmapId: string;
  dayIndex: number;
  type: string;
  subredditId: string | null;
  title: string | null;
  instructions: string;
  estimatedTime: number | null;
  priority: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED";
};

type TaskDraft = {
  id: string;
  title: string | null;
  status: "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  updatedAt: string;
};

function formatTaskType(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const taskId = params?.id ? decodeURIComponent(params.id) : "";

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [taskRes, contentRes] = await Promise.all([
          fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/tasks/${encodeURIComponent(taskId)}/content?limit=1`, {
            cache: "no-store",
          }),
        ]);

        const taskJson = (await taskRes.json()) as
          | { task?: TaskDetail; error?: string }
          | undefined;
        const contentJson = (await contentRes.json()) as
          | { items?: TaskDraft[]; error?: string }
          | undefined;

        if (!taskRes.ok || !taskJson?.task) {
          throw new Error(taskJson?.error ?? "Task not found");
        }
        if (!contentRes.ok) {
          throw new Error(contentJson?.error ?? "Failed to load task drafts");
        }

        if (cancelled) return;

        setTask(taskJson.task);
        setDraft(
          (contentJson?.items ?? []).find(
            (item) => item.status !== "ARCHIVED",
          ) ?? null,
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load task";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!taskId) {
      setError("Task not found");
      setLoading(false);
      return;
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const canSchedule = useMemo(() => {
    return draft?.status === "APPROVED";
  }, [draft]);

  const checklist = useMemo(() => {
    return [
      "Review subreddit rules summary",
      "Generate 3 draft variants",
      "Select a final draft and edit",
      "Request approval",
      "Schedule after approval",
    ];
  }, []);

  async function handleOpenOrGenerateDraft() {
    if (!task) return;
    if (draft?.id) {
      router.push(`/content/drafts/${encodeURIComponent(draft.id)}`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}/generate-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "GENERATE",
            variantCount: 3,
            length: "medium",
          }),
        },
      );

      const json = (await res.json()) as
        | { draft?: TaskDraft; error?: string }
        | undefined;

      if ((res.status !== 202 && !res.ok) || !json?.draft?.id) {
        throw new Error(json?.error ?? "Failed to generate draft");
      }

      setDraft(json.draft);
      router.push(`/content/drafts/${encodeURIComponent(json.draft.id)}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate draft";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Loading task...</h1>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Task not found</h1>
        <Link href="/roadmaps" className="text-sm underline">
          Back to roadmaps
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Task
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {formatTaskType(task.type)} for {task.subredditId ?? "general"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Day {task.dayIndex}
            {typeof task.estimatedTime === "number"
              ? ` | ${task.estimatedTime} min`
              : ""}
            <span className="mx-2 text-muted-foreground/40">|</span>
            Status: {task.status.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/roadmaps/${encodeURIComponent(task.roadmapId)}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to roadmap
          </Link>
          <button
            type="button"
            disabled={generating}
            onClick={() => {
              void handleOpenOrGenerateDraft();
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {generating
              ? "Generating..."
              : draft
                ? "Open draft"
                : "Generate draft"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Task checklist guidance</p>
          <p className="mt-2 text-sm text-muted-foreground">
            These steps are guidance only. Complete them in the draft flow.
          </p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            {checklist.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3"
              >
                <span
                  className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Task notes</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {task.instructions}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Task status", value: task.status.toLowerCase() },
              {
                label: "Current draft",
                value: draft
                  ? draft.title?.trim() || "Untitled"
                  : "Not generated",
              },
              {
                label: "Draft state",
                value: draft ? draft.status.toLowerCase() : "none",
              },
              { label: "Priority", value: String(task.priority) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card/80 px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Scheduling</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Scheduling is available after draft approval.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Open calendar
          </Link>
          <Link
            href="/scheduling/queue"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            View queue
          </Link>
          <span className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
            {canSchedule ? "Eligible to schedule" : "Approval required"}
          </span>
        </div>
      </div>
    </div>
  );
}
