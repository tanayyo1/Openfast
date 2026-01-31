"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDemoStore } from "@/stores/demoStore";

export default function SchedulingCalendarPage() {
  const tasks = useDemoStore((state) => state.tasks);
  const drafts = useDemoStore((state) => state.drafts);
  const scheduleTask = useDemoStore((state) => state.scheduleTask);

  const approved = useMemo(() => {
    return tasks.filter((task) => task.status === "Approved");
  }, [tasks]);

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

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Approved drafts</p>
        <p className="mt-2 text-sm text-muted-foreground">
          In the MVP demo, scheduling uses the suggested window from each task.
        </p>

        {approved.length === 0 ? (
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
            {approved.map((task) => {
              const draft = drafts.find((d) => d.taskId === task.id);
              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-border bg-card/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">
                        {task.type} in {task.subreddit}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Window: {task.bestWindow}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Draft: {draft ? draft.editedTitle : "Not generated"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {draft ? (
                        <Link
                          href={`/content/drafts/${encodeURIComponent(draft.id)}`}
                          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                        >
                          Review
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          scheduleTask({
                            taskId: task.id,
                            scheduledAt: task.bestWindow,
                          })
                        }
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Timezone and editing (next)</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The MVP demo does not include timezone selection, rescheduling, or
          reminders yet.
        </p>
      </div>
    </div>
  );
}
