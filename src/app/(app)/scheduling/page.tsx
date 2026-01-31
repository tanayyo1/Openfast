import Link from 'next/link'

export default function SchedulingPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Queue and calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Schedule only after approval. Review upcoming posts and jobs.
          </p>
        </div>
        <Link
          href="/scheduling/calendar"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open calendar
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/scheduling/calendar"
          className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
        >
          <p className="text-sm font-semibold">Calendar view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Find best-time windows and schedule into open slots.
          </p>
        </Link>
        <Link
          href="/scheduling/queue"
          className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
        >
          <p className="text-sm font-semibold">Queue view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Track scheduled jobs, retries, and publishing history.
          </p>
        </Link>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Safety reminder</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Posts must be approved before scheduling. If an account is new or health is low,
          the system should recommend comments instead of posts.
        </p>
      </div>
    </div>
  )
}
