'use client'

import Link from 'next/link'
import { useDemoStore } from '@/stores/demoStore'

export default function ProjectsPage() {
  const projects = useDemoStore((state) => state.projects)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Projects
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Your projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track progress, update brand voice, and manage approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding/create-project"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            New project
          </Link>
          <Link
            href="/projects/empty"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Empty state
          </Link>
          <Link
            href="/projects/loading"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Loading state
          </Link>
          <Link
            href="/projects/error"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Error state
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first project to generate subreddit recommendations and roadmaps.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding/create-project"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create project
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Onboarding
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${encodeURIComponent(project.id)}`}
              className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{project.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {project.goals.length > 0 ? project.goals.join(', ') : 'No goals set'}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  Active
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
