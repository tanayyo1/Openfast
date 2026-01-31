import Link from 'next/link'
import { BarMeter } from '@/components/app/charts/BarMeter'

const accounts = [
  {
    username: 'founder_handle',
    score: 82,
    tier: 'Established',
    cadence: '3 to 5 posts per day',
    flags: ['2 rule reminders'],
  },
  {
    username: 'product_notes',
    score: 61,
    tier: 'New',
    cadence: '1 to 2 posts per day',
    flags: ['Limit links', 'Prefer comments'],
  },
]

export default function HealthPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Account health
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Protect delivery and trust</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track removals, visibility signals, and recommended pacing tiers.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          View opportunities
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((account) => (
          <div
            key={account.username}
            className="rounded-[24px] border border-border bg-card/80 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">u/{account.username}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tier: {account.tier} 
                  <span className="mx-2 text-muted-foreground/40">|</span>
                  Suggested cadence: {account.cadence}
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                Score {account.score}
              </span>
            </div>

            <div className="mt-5">
              <BarMeter label="Health score" value={account.score} />
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Signals
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {account.flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
                <li>Visibility check: likely visible</li>
                <li>No shadowban signals detected</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Run visibility check
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                View history
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Guardrails</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Approval gate',
              detail: 'Drafts must be approved before scheduling and publishing.',
            },
            {
              title: 'Rate limiting',
              detail: 'Requests are paced per account to match Reddit limits.',
            },
            {
              title: 'Duplicate control',
              detail: 'Similar drafts across subreddits should be blocked or rewritten.',
            },
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
