import { MaxWidth } from '@/components/public/MaxWidth'

export default function SubredditAnalyzerPage() {
  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Free tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold">Subreddit analyzer</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Check rules, activity, and best-time windows before you post.
            </p>
            <div className="mt-8 rounded-[24px] border border-border bg-card/80 p-6">
              <label className="text-sm font-semibold" htmlFor="subreddit">
                Subreddit name
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="subreddit"
                  type="text"
                  placeholder="r/startups"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <button
                  type="button"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Analyze
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Results are cached for faster analysis and lower rate limits.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Rule summary</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Promotional links limited to 1 per post.</li>
                <li>Use descriptive titles with context.</li>
                <li>Weekly discussion threads are preferred.</li>
              </ul>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Best-time windows</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {['Tue 09:00', 'Thu 13:00', 'Sat 10:00', 'Sun 18:00'].map((slot) => (
                  <div
                    key={slot}
                    className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm font-semibold"
                  >
                    {slot}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Risk signals</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Promo tolerance</p>
                  <p className="text-sm font-semibold">Low</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Removal trend</p>
                  <p className="text-sm font-semibold">Moderate</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Posting cadence</p>
                  <p className="text-sm font-semibold">2 posts per week</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Comment focus</p>
                  <p className="text-sm font-semibold">Recommended</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  )
}
