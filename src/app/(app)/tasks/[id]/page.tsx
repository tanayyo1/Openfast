"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useDemoStore } from "@/stores/demoStore";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const taskId = params?.id ? decodeURIComponent(params.id) : "";

  const task = useDemoStore((state) =>
    state.tasks.find((item) => item.id === taskId),
  );
  const project = useDemoStore((state) =>
    task ? state.projects.find((p) => p.id === task.projectId) : undefined,
  );
  const roadmap = useDemoStore((state) =>
    task ? state.roadmaps.find((r) => r.id === task.roadmapId) : undefined,
  );
  const generateDraftForTask = useDemoStore(
    (state) => state.generateDraftForTask,
  );

  const draftId = task?.draftId;

  const canSchedule =
    task?.status === "Approved" || task?.status === "Scheduled";

  const checklist = useMemo(() => {
    return [
      "Review subreddit rules summary",
      "Generate 3 draft variants",
      "Select a final draft and edit",
      "Request approval",
      "Schedule after approval",
    ];
  }, []);

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
            {task.type} for {task.subreddit}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Project: {project?.name ?? "Unknown"}
            <span className="mx-2 text-muted-foreground/40">|</span>
            Best-time window: {task.bestWindow}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {roadmap ? (
            <Link
              href={`/roadmaps/${encodeURIComponent(roadmap.id)}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Back to roadmap
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (draftId) {
                router.push(`/content/drafts/${encodeURIComponent(draftId)}`);
                return;
              }

              const createdDraftId = generateDraftForTask({ taskId: task.id });
              if (createdDraftId) {
                router.push(
                  `/content/drafts/${encodeURIComponent(createdDraftId)}`,
                );
              }
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {draftId ? "Open draft" : "Generate draft"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Task checklist</p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            {checklist.map((item) => (
              <label
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3"
              >
                <input type="checkbox" className="mt-1 h-4 w-4" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Subreddit notes</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep titles descriptive, avoid repeated links, and focus on
            discussion prompts.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Promo tolerance", value: "Low" },
              { label: "Suggested cadence", value: "2 posts/week" },
              { label: "Link policy", value: "1 link max" },
              { label: "Auto-mod risk", value: "Moderate" },
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
          Scheduling is available after approval.
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
