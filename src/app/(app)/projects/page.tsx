import Link from 'next/link'

const projects = [
  {
    name: 'Pulse CRM',
    status: 'Active',
    niche: 'B2B SaaS',
    tasks: '12 scheduled',
  },
  {
    name: 'FinOps Stack',
    status: 'Draft',
    niche: 'Finance teams',
    tasks: '6 drafts',
  },
  {
    name: 'AI Notes',
    status: 'Active',
    niche: 'Productivity',
    tasks: '4 pending review',
  },
]

export default function ProjectsPage() {
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
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            New project
          </button>
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

      <div className="grid gap-4">
        {projects.map((project) => (
          <Link
            key={project.name}
            href={`/projects/${encodeURIComponent(project.name)}`}
            className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{project.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.niche}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {project.status}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{project.tasks}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
