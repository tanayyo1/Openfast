'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { SimpleTable } from '@/components/app/tables/SimpleTable'
import { useDemoStore } from '@/stores/demoStore'

type Row = {
  id: string
  task: string
  runAt: string
  status: string
}

export default function SchedulingQueuePage() {
  const tasks = useDemoStore((state) => state.tasks)
  const markPublished = useDemoStore((state) => state.markPublished)

  const rows: Row[] = useMemo(() => {
    return tasks
      .filter((task) => task.status === 'Scheduled' || task.status === 'Published')
      .map((task) => ({
        id: task.id,
        task: `${task.type} in ${task.subreddit}`,
        runAt: task.scheduledAt ?? task.bestWindow,
        status: task.status,
      }))
  }, [tasks])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track scheduled jobs and publishing history.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Calendar
          </Link>
          <Link
            href="/analytics"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Analytics
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No scheduled items</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve a draft and schedule it in the calendar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/scheduling/calendar"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open calendar
            </Link>
            <Link
              href="/approvals"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Approvals
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <SimpleTable<Row>
            columns={[
              { key: 'task', header: 'Task', render: (row) => row.task },
              { key: 'runAt', header: 'Run at', render: (row) => row.runAt },
              { key: 'status', header: 'Status', render: (row) => row.status },
            ]}
            getRowKey={(row) => row.id}
            rows={rows}
          />

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Publish (demo)</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Mark scheduled items as published to simulate the worker pipeline and populate analytics.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {tasks
                .filter((task) => task.status === 'Scheduled')
                .map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => markPublished({ taskId: task.id })}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Mark published: {task.subreddit}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Failure handling (next)</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Transient errors should retry with backoff. Permanent errors should fail with a clear reason and a suggested fix.
        </p>
      </div>
    </div>
  )
}
