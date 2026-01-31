import { SimpleTable } from '@/components/app/tables/SimpleTable'

type Row = {
  id: string
  task: string
  account: string
  runAt: string
  status: string
}

const rows: Row[] = [
  {
    id: 'job-1',
    task: 'Post in r/startups',
    account: 'u/founder_handle',
    runAt: 'Tue 09:00',
    status: 'Queued',
  },
  {
    id: 'job-2',
    task: 'Comment opportunity',
    account: 'u/product_notes',
    runAt: 'Thu 13:00',
    status: 'Scheduled',
  },
  {
    id: 'job-3',
    task: 'Metrics fetch',
    account: 'u/founder_handle',
    runAt: 'Every 30 min',
    status: 'Running',
  },
]

export default function SchedulingQueuePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Scheduling
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track scheduled jobs, retries, and publishing history.
        </p>
      </div>

      <SimpleTable<Row>
        columns={[
          { key: 'task', header: 'Task', render: (row) => row.task },
          { key: 'account', header: 'Account', render: (row) => row.account },
          { key: 'runAt', header: 'Run at', render: (row) => row.runAt },
          { key: 'status', header: 'Status', render: (row) => row.status },
        ]}
        getRowKey={(row) => row.id}
        rows={rows}
      />

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Failure handling (preview)</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Transient errors should retry with backoff. Permanent errors should fail with a
          clear reason and a suggested fix.
        </p>
      </div>
    </div>
  )
}
