import Link from 'next/link'

type ProjectSettingsProps = {
  params: { id: string }
}

export default function ProjectSettingsPage({ params }: ProjectSettingsProps) {
  const projectName = decodeURIComponent(params.id)

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Project settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{projectName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update brand voice, goals, and compliance preferences.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              type="text"
              defaultValue={projectName}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="niche">
              Niche
            </label>
            <input
              id="niche"
              type="text"
              placeholder="B2B SaaS"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="voice">
            Brand voice
          </label>
          <textarea
            id="voice"
            rows={4}
            placeholder="Helpful, data-driven, and concise"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>
        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="goals">
            Goals
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Traffic', 'Feedback', 'Leads', 'Community'].map((goal) => (
              <label
                key={goal}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs"
              >
                <input type="checkbox" className="h-3 w-3" />
                {goal}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save changes
          </button>
          <Link
            href={`/projects/${encodeURIComponent(projectName)}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  )
}
