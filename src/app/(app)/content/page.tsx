import Link from 'next/link'

const drafts = [
  {
    id: 'task-1',
    title: 'How we handle churn interviews as a two-person team',
    status: 'Needs approval',
    project: 'Pulse CRM',
    subreddit: 'r/startups',
    risk: 'Low',
  },
  {
    id: 'task-2',
    title: 'Looking for feedback on our onboarding flow metrics',
    status: 'Draft',
    project: 'AI Notes',
    subreddit: 'r/SaaS',
    risk: 'Medium',
  },
  {
    id: 'task-3',
    title: 'What would you automate in your weekly reporting?',
    status: 'Approved',
    project: 'FinOps Stack',
    subreddit: 'r/Entrepreneur',
    risk: 'Low',
  },
]

export default function ContentPage() {
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
            href="/roadmaps/rm-jan"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            View roadmap tasks
          </Link>
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Generate new draft
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {drafts.map((draft) => (
          <Link
            key={draft.id}
            href={`/content/drafts/${draft.id}`}
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
