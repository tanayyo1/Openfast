import { MaxWidth } from '@/components/public/MaxWidth'

export default function ShadowbanCheckPage() {
  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Free tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold">Shadowban detector</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Check visibility signals and track account health trends.
            </p>
            <div className="mt-8 rounded-[24px] border border-border bg-card/80 p-6">
              <label className="text-sm font-semibold" htmlFor="username">
                Reddit username
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="username"
                  type="text"
                  placeholder="username"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <button
                  type="button"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Run check
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                We store checks only when you connect a Reddit account.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Visibility result</p>
              <p className="mt-3 text-lg font-semibold">Likely visible</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Recent posts appear in logged-out checks with normal engagement.
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Account health snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Health score</p>
                  <p className="text-sm font-semibold">82 / 100</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Recent removals</p>
                  <p className="text-sm font-semibold">0 in last 30 days</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Suggested cadence</p>
                  <p className="text-sm font-semibold">3 posts per week</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Risk flags</p>
                  <p className="text-sm font-semibold">None detected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  )
}
