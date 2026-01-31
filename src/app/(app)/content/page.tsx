'use client'

import Link from 'next/link'
import { useDemoStore } from '@/stores/demoStore'

export default function ContentPage() {
  const drafts = useDemoStore((state) => state.drafts)
  const tasks = useDemoStore((state) => state.tasks)
  const projects = useDemoStore((state) => state.projects)

  const rows = drafts.map((draft) => {
    const task = tasks.find((t) => t.id === draft.taskId)
    const project = projects.find((p) => p.id === draft.projectId)

    return {
      id: draft.id,
      title: draft.editedTitle,
      status: draft.status,
      project: project?.name ?? 'Unknown',
      subreddit: task?.subreddit ?? draft.subreddit,
      risk:
        draft.variants[draft.selectedIndex]?.riskScore ??
        draft.variants[0]?.riskScore ??
        0,
    }
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Content
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Drafts and variants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate variants, edit, then request approval before scheduling.
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
            href="/roadmaps"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View roadmaps
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No drafts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a task and generate a draft to start.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/roadmaps"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to roadmaps
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((draft) => (
            <Link
              key={draft.id}
              href={`/content/drafts/${encodeURIComponent(draft.id)}`}
              className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{draft.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {draft.project}
                    <span className="mx-2 text-muted-foreground/40">|</span>
                    {draft.subreddit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {draft.status}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">Risk: {draft.risk}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Quality checklist</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Avoid hard CTAs', detail: 'Keep language helpful and discussion-led.' },
            { title: 'Respect rules', detail: 'Match title format, link limits, and flair.' },
            { title: 'Prevent duplicates', detail: 'Do not re-post similar drafts across subs.' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
