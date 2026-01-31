import Link from 'next/link'

const slots = [
  { day: 'Tue', time: '09:00', label: 'Best window', status: 'Open' },
  { day: 'Tue', time: '13:00', label: 'Good window', status: 'Booked' },
  { day: 'Thu', time: '13:00', label: 'Best window', status: 'Open' },
  { day: 'Sat', time: '10:00', label: 'Best window', status: 'Open' },
]

export default function SchedulingCalendarPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Place approved drafts into recommended time windows.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/scheduling/queue"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            View queue
          </Link>
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Schedule selected
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Recommended slots</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This view will become a real calendar. For now it shows placeholder slots.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((slot) => (
            <div
              key={`${slot.day}-${slot.time}`}
              className="rounded-2xl border border-border bg-card/80 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {slot.day} {slot.time}
              </p>
              <p className="mt-2 text-sm font-semibold">{slot.label}</p>
              <p className="mt-2 text-xs text-muted-foreground">Status: {slot.status}</p>
              <button
                type="button"
                className="mt-4 w-full rounded-full border border-border px-3 py-2 text-xs font-semibold"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Approval gate</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Scheduling should only accept approved drafts. Pending drafts must stay in the
          content queue.
        </p>
      </div>
    </div>
  )
}
