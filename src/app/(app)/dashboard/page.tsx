import Link from 'next/link'

const stats = [
  { label: 'Active projects', value: '3', detail: '2 in growth phase' },
  { label: 'Drafts pending', value: '9', detail: '4 need approval' },
  { label: 'Scheduled this week', value: '14', detail: '8 posts, 6 comments' },
]

const tasks = [
  {
    title: 'Review draft for r/startups',
    project: 'Pulse CRM',
    time: 'Today, 3:00 PM',
  },
  {
    title: 'Approve best-time schedule',
    project: 'FinOps Stack',
    time: 'Tomorrow, 9:30 AM',
  },
  {
    title: 'Check subreddit rules update',
    project: 'AI Notes',
    time: 'Fri, 11:00 AM',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review today’s approvals and keep your roadmap on pace.
          </p>
        </div>
        <Link
          href="/projects"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          View projects
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[24px] border border-border bg-card/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Today’s priority tasks</p>
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <div
                key={task.title}
                className="rounded-2xl border border-border bg-card/80 p-4"
              >
                <p className="text-sm font-semibold">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{task.project}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>{task.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Account health</p>
          <p className="mt-3 text-2xl font-semibold">82 / 100</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Low risk. Keep cadence under 3 posts per week for new accounts.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Signals
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>No recent removals detected</li>
              <li>2 rule reminders across tracked subreddits</li>
              <li>Engagement trending up week over week</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
