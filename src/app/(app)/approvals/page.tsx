"use client";

import Link from "next/link";
import { useDemoStore } from "@/stores/demoStore";

export default function ApprovalsPage() {
  const tasks = useDemoStore((state) => state.tasks);
  const drafts = useDemoStore((state) => state.drafts);
  const approveDraft = useDemoStore((state) => state.approveDraft);

  const pending = tasks.filter((task) => task.status === "Needs approval");

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

      {pending.length === 0 ? (
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
          {pending.map((task) => {
            const draft = drafts.find((d) => d.taskId === task.id);
            return (
              <div
                key={task.id}
                className="rounded-[24px] border border-border bg-card/80 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">
                      {task.type} in {task.subreddit}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Best-time window: {task.bestWindow}
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
                        Review draft
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => approveDraft({ taskId: task.id })}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Approve
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
