import Link from 'next/link'
import { BarMeter } from '@/components/app/charts/BarMeter'
import { SimpleTable } from '@/components/app/tables/SimpleTable'

type Row = {
  post: string
  subreddit: string
  score: string
  comments: string
  status: string
}

const rows: Row[] = [
  {
    post: 'Churn interview template and lessons',
    subreddit: 'r/startups',
    score: '42',
    comments: '18',
    status: 'Live',
  },
  {
    post: 'Onboarding metrics benchmark question',
    subreddit: 'r/SaaS',
    score: '21',
    comments: '9',
    status: 'Live',
  },
  {
    post: 'Automated weekly reporting prompt',
    subreddit: 'r/Entrepreneur',
    score: '8',
    comments: '3',
    status: 'Removed',
  },
]

type AnalyticsProjectProps = {
  params: { id: string }
}

export default function AnalyticsProjectPage({ params }: AnalyticsProjectProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Project {params.id}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare subreddits, time windows, and post outcomes.
          </p>
        </div>
        <Link
          href="/analytics"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Back
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">This week</p>
          <div className="mt-4 space-y-4">
            <BarMeter label="Approval rate" value={78} />
            <BarMeter label="Publish success" value={92} />
            <BarMeter label="First hour engagement" value={64} />
          </div>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-6 lg:col-span-2">
          <p className="text-sm font-semibold">Posts</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This table becomes filterable by subreddit and time window.
          </p>
          <div className="mt-4">
            <SimpleTable<Row>
              columns={[
                { key: 'post', header: 'Post', render: (row) => row.post },
                { key: 'sub', header: 'Subreddit', render: (row) => row.subreddit },
                { key: 'score', header: 'Score', render: (row) => row.score },
                { key: 'comments', header: 'Comments', render: (row) => row.comments },
                { key: 'status', header: 'Status', render: (row) => row.status },
              ]}
              getRowKey={(row) => `${row.subreddit}-${row.post}`}
              rows={rows}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Time window insights (preview)</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Tue 09:00', value: 'High' },
            { label: 'Thu 13:00', value: 'High' },
            { label: 'Sat 10:00', value: 'Medium' },
            { label: 'Sun 18:00', value: 'Low' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-background/70 px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
