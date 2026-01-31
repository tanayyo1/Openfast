import Link from 'next/link'

const goals = [
  { label: 'Traffic', description: 'Send qualified visits to your landing page.' },
  { label: 'Feedback', description: 'Validate positioning and roadmap decisions.' },
  { label: 'Leads', description: 'Collect demos and signups without spam.' },
  { label: 'Community', description: 'Build long-term presence and trust.' },
]

export default function CreateProjectPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Onboarding
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Create your first project</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add core details so we can recommend subreddits and safe posting cadence.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Pulse CRM"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="url">
              Product URL (optional)
            </label>
            <input
              id="url"
              type="url"
              placeholder="https://yourproduct.com"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="desc">
            Product description
          </label>
          <textarea
            id="desc"
            rows={5}
            placeholder="Describe what you do, who it helps, and why it is different."
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="voice">
            Brand voice
          </label>
          <textarea
            id="voice"
            rows={4}
            placeholder="Helpful, concise, and honest. No hype."
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Goals</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {goals.map((goal) => (
              <label
                key={goal.label}
                className="flex items-start gap-3 rounded-[20px] border border-border bg-background/70 px-4 py-3"
              >
                <input type="checkbox" className="mt-1 h-4 w-4" />
                <span>
                  <span className="block text-sm font-semibold">{goal.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {goal.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Safety pacing
            </p>
            <p className="mt-2 text-sm font-semibold">Conservative by default</p>
            <p className="mt-2 text-sm text-muted-foreground">
              New accounts start with light posting and heavier commenting.
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Compliance notes
            </p>
            <p className="mt-2 text-sm font-semibold">Human approval required</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Drafts must be approved before scheduling to protect your account.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save project
          </button>
          <Link
            href="/onboarding"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  )
}
