import Link from 'next/link'
import { Sparkline } from '@/components/app/charts/Sparkline'

const projects = [
  {
    id: 'pulse',
    name: 'Pulse CRM',
    metric: 'Weekly karma',
    points: [2, 4, 3, 6, 10, 9, 12],
    change: '+18%',
  },
  {
    id: 'finops',
    name: 'FinOps Stack',
    metric: 'Weekly comments',
    points: [1, 2, 2, 4, 5, 7, 8],
    change: '+12%',
  },
  {
    id: 'ainotes',
    name: 'AI Notes',
    metric: 'Weekly score',
    points: [5, 6, 7, 7, 8, 10, 14],
    change: '+24%',
  },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Analytics
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Performance overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track engagement trends and learn which windows deliver early velocity.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/analytics/projects/${project.id}`}
            className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{project.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.metric}
                </p>
                <p className="mt-4 text-sm font-semibold">{project.change}</p>
              </div>
              <Sparkline points={project.points} className="h-10 w-28 text-primary" />
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">What to watch</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'First hour comments',
              detail: 'Early discussion is the strongest predictor of visibility.',
            },
            {
              title: 'Removal signals',
              detail: 'Track soft removals to protect account health.',
            },
            {
              title: 'Time window performance',
              detail: 'Compare windows to learn which slots consistently win.',
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
