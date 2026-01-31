import Link from 'next/link'

const tasks = [
  {
    title: 'Review draft for r/startups',
    status: 'Awaiting approval',
    schedule: 'Today 3:00 PM',
  },
  {
    title: 'Comment on trending thread',
    status: 'Drafted',
    schedule: 'Tomorrow 10:00 AM',
  },
  {
    title: 'Publish product update',
    status: 'Scheduled',
    schedule: 'Fri 9:30 AM',
  },
]

type ProjectPageProps = {
  params: { id: string }
}

export default function ProjectDetailPage({ params }: ProjectPageProps) {
  const projectName = decodeURIComponent(params.id)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Project overview
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{projectName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track roadmap progress and review upcoming approvals.
          </p>
        </div>
        <Link
          href={`/projects/${encodeURIComponent(projectName)}/settings`}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Settings
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {['Roadmap 67% complete', 'Compliance risk low', 'Next best time: Thu 13:00'].map(
          (item) => (
            <div
              key={item}
              className="rounded-[24px] border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item}</p>
            </div>
          )
        )}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Upcoming tasks</p>
        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <div
              key={task.title}
              className="rounded-2xl border border-border bg-card/80 p-4"
            >
              <p className="text-sm font-semibold">{task.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{task.status}</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{task.schedule}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
