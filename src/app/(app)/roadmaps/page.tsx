import Link from 'next/link'

const roadmaps = [
  {
    id: 'rm-jan',
    title: 'January growth sprint',
    window: 'Jan 1 - Jan 30',
    status: 'Active',
    tasks: '42 tasks',
  },
  {
    id: 'rm-feb',
    title: 'February experiment plan',
    window: 'Feb 1 - Feb 28',
    status: 'Draft',
    tasks: '28 tasks',
  },
]

export default function RoadmapsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Roadmaps
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Planning and pacing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a task plan with best-time windows and safe cadence.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Generate roadmap
        </button>
      </div>

      <div className="grid gap-4">
        {roadmaps.map((roadmap) => (
          <Link
            key={roadmap.id}
            href={`/roadmaps/${roadmap.id}`}
            className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{roadmap.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{roadmap.window}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {roadmap.status}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{roadmap.tasks}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">What a roadmap includes</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Best-time windows',
              description: 'Suggested slots per subreddit based on activity signals.',
            },
            {
              title: 'Task mix',
              description: 'Balance posts and comments based on account age and karma.',
            },
            {
              title: 'Compliance guardrails',
              description: 'Rule reminders and duplication prevention built into each task.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
