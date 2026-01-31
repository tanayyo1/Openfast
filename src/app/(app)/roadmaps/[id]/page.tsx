import Link from 'next/link'

const tasks = [
  {
    id: 'task-1',
    type: 'Post',
    subreddit: 'r/startups',
    window: 'Tue 09:00',
    status: 'Draft',
  },
  {
    id: 'task-2',
    type: 'Comment',
    subreddit: 'r/Entrepreneur',
    window: 'Thu 13:00',
    status: 'Ready',
  },
  {
    id: 'task-3',
    type: 'Post',
    subreddit: 'r/SaaS',
    window: 'Sat 10:00',
    status: 'Scheduled',
  },
]

type RoadmapDetailProps = {
  params: { id: string }
}

export default function RoadmapDetailPage({ params }: RoadmapDetailProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Roadmap
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Roadmap {params.id}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review tasks, generate drafts, and schedule after approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to projects
          </Link>
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Tasks</p>
        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4 transition hover:border-foreground/40"
            >
              <div>
                <p className="text-sm font-semibold">
                  {task.type} in {task.subreddit}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Best-time window: {task.window}
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {task.status}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Drafts pending approval', value: '4' },
          { label: 'Scheduled items', value: '3' },
          { label: 'Compliance flags', value: '1' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-border bg-card/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
