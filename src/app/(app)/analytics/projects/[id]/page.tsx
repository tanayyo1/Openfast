'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { BarMeter } from '@/components/app/charts/BarMeter'
import { SimpleTable } from '@/components/app/tables/SimpleTable'
import { useDemoStore } from '@/stores/demoStore'

type Row = {
  post: string
  subreddit: string
  score: string
  comments: string
  status: string
}

function scoreForStatus(status: string) {
  if (status === 'Published') return { score: '42', comments: '18', status: 'Live' }
  if (status === 'Scheduled') return { score: '-', comments: '-', status: 'Scheduled' }
  if (status === 'Failed') return { score: '0', comments: '0', status: 'Removed' }
  return { score: '-', comments: '-', status: status }
}

export default function AnalyticsProjectPage() {
  const params = useParams<{ id: string }>()
  const projectId = params?.id ? decodeURIComponent(params.id) : ''

  const project = useDemoStore((state) => state.projects.find((p) => p.id === projectId))
  const tasks = useDemoStore((state) => state.tasks.filter((t) => t.projectId === projectId))
  const drafts = useDemoStore((state) => state.drafts)

  const rows: Row[] = useMemo(() => {
    return tasks
      .filter((task) => task.draftId)
      .map((task) => {
        const draft = drafts.find((d) => d.taskId === task.id)
        const meta = scoreForStatus(task.status)
        return {
          post: draft?.editedTitle ?? `${task.type} draft`,
          subreddit: task.subreddit,
          score: meta.score,
          comments: meta.comments,
          status: meta.status,
        }
      })
  }, [drafts, tasks])

  const approvedCount = tasks.filter((t) => t.status === 'Approved' || t.status === 'Scheduled' || t.status === 'Published').length
  const publishedCount = tasks.filter((t) => t.status === 'Published').length
  const approvalRate = tasks.length === 0 ? 0 : Math.round((approvedCount / tasks.length) * 100)
  const publishSuccess = tasks.length === 0 ? 0 : Math.round((publishedCount / tasks.length) * 100)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{project?.name ?? 'Project'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Demo metrics derived from scheduled and published tasks.
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
            <BarMeter label="Approval rate" value={approvalRate} />
            <BarMeter label="Publish success" value={publishSuccess} />
            <BarMeter label="First hour engagement" value={Math.min(100, publishedCount * 20)} />
          </div>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-6 lg:col-span-2">
          <p className="text-sm font-semibold">Posts</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Filter by subreddit and time window in the next phase.
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
