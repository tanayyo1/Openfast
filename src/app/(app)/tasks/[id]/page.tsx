import Link from 'next/link'

const task = {
  id: 'task-1',
  project: 'Pulse CRM',
  type: 'Post',
  subreddit: 'r/startups',
  bestWindow: 'Tue 09:00',
  status: 'Draft',
}

export default function TaskDetailPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Task
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{task.type} for {task.subreddit}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Project: {task.project} 
            <span className="mx-2 text-muted-foreground/40">|</span>
            Best-time window: {task.bestWindow}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/roadmaps/rm-jan"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to roadmap
          </Link>
          <Link
            href="/content/drafts/task-1"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Open draft
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Task checklist</p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            {[
              'Review subreddit rules summary',
              'Generate 3 draft variants',
              'Select a final draft and edit',
              'Request approval',
              'Schedule after approval',
            ].map((item) => (
              <label
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3"
              >
                <input type="checkbox" className="mt-1 h-4 w-4" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Subreddit notes</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep titles descriptive, avoid repeated links, and focus on discussion prompts.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Promo tolerance', value: 'Low' },
              { label: 'Suggested cadence', value: '2 posts/week' },
              { label: 'Link policy', value: '1 link max' },
              { label: 'Auto-mod risk', value: 'Moderate' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card/80 px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Scheduling (preview)</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Scheduling is available after approval. Use the calendar in the scheduling section.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Open calendar
          </Link>
          <Link
            href="/scheduling/queue"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            View queue
          </Link>
        </div>
      </div>
    </div>
  )
}
