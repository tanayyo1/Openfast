'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useDemoStore } from '@/stores/demoStore'

export default function DashboardPage() {
  const projects = useDemoStore((state) => state.projects)
  const tasks = useDemoStore((state) => state.tasks)
  const drafts = useDemoStore((state) => state.drafts)

  const stats = useMemo(() => {
    const pendingApprovals = tasks.filter((t) => t.status === 'Needs approval').length
    const scheduled = tasks.filter((t) => t.status === 'Scheduled').length

    return [
      {
        label: 'Projects',
        value: String(projects.length),
        detail: projects.length > 0 ? 'Ready for roadmaps' : 'Create your first project',
        href: '/projects',
      },
      {
        label: 'Drafts',
        value: String(drafts.length),
        detail: pendingApprovals > 0 ? `${pendingApprovals} need approval` : 'No approvals pending',
        href: '/content',
      },
      {
        label: 'Scheduled',
        value: String(scheduled),
        detail: scheduled > 0 ? 'Ready to publish (demo)' : 'Nothing scheduled',
        href: '/scheduling/queue',
      },
    ]
  }, [drafts.length, projects.length, tasks])

  const priority = useMemo(() => {
    const ordering = {
      'Needs approval': 0,
      Draft: 1,
      Approved: 2,
      Scheduled: 3,
      Published: 4,
      Failed: 5,
    } as const

    return [...tasks]
      .sort((a, b) => ordering[a.status] - ordering[b.status])
      .slice(0, 5)
  }, [tasks])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold">MVP demo workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow the flow: project, connect, roadmap, task, draft, approve, schedule, analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Onboarding
          </Link>
          <Link
            href="/roadmaps/generate"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Generate roadmap
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-[24px] border border-border bg-card/80 p-5 transition hover:border-foreground/40"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.detail}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Priority tasks</p>
          {priority.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold">No tasks yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate a roadmap to create tasks.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {priority.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="block rounded-2xl border border-border bg-card/80 p-4 transition hover:border-foreground/40"
                >
                  <p className="text-sm font-semibold">
                    {task.type} in {task.subreddit}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Status: {task.status}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>Window: {task.bestWindow}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Demo controls</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use Settings to reset demo data or sign out.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/settings"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Settings
            </Link>
            <Link
              href="/approvals"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Approvals
            </Link>
            <Link
              href="/analytics"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
