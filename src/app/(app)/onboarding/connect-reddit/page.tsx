import Link from 'next/link'

const scopes = [
  {
    name: 'identity',
    note: 'Read your Reddit username and account metadata.',
  },
  {
    name: 'submit',
    note: 'Create posts after you approve drafts.',
  },
  {
    name: 'read',
    note: 'Fetch subreddit data and engagement metrics.',
  },
  {
    name: 'history',
    note: 'Track your recent submissions and comments for analytics.',
  },
]

const connectedAccounts = [
  { username: 'founder_handle', status: 'Healthy', cadence: '3 posts per week' },
  { username: 'product_notes', status: 'New', cadence: '1 post per week' },
]

export default function ConnectRedditPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Onboarding
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Connect your Reddit account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We use OAuth with strict rate limits. Tokens are encrypted at rest.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Permissions requested</p>
          <p className="mt-2 text-sm text-muted-foreground">
            These scopes let us generate roadmaps, schedule posts, and fetch analytics.
          </p>
          <div className="mt-5 space-y-3">
            {scopes.map((scope) => (
              <div
                key={scope.name}
                className="rounded-2xl border border-border bg-background/70 p-4"
              >
                <p className="text-sm font-semibold">{scope.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{scope.note}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Connect via Reddit OAuth
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            You can disconnect at any time. We never store tokens in logs.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Connected accounts</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep accounts healthy by following safe cadence tiers.
            </p>
            <div className="mt-4 space-y-3">
              {connectedAccounts.map((account) => (
                <div
                  key={account.username}
                  className="rounded-2xl border border-border bg-card/80 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">u/{account.username}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account.cadence}
                      </p>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {account.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Safety reminders</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Every post requires explicit approval before scheduling.</li>
              <li>Start with comments on new accounts to build karma.</li>
              <li>Follow subreddit rules and avoid repeated links.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
        >
          Back
        </Link>
        <Link
          href="/projects"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Continue to projects
        </Link>
      </div>
    </div>
  )
}
