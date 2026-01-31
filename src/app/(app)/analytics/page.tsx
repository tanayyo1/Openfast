const pageName = 'analytics'

export default function PlaceholderPage() {
  const title = pageName.charAt(0).toUpperCase() + pageName.slice(1)
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <h1 className="text-3xl font-semibold">{title} overview</h1>
      <p className="text-sm text-muted-foreground">
        This section will be implemented in the next frontend phase.
      </p>
      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Placeholder content</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add charts, tables, and workflows for {title.toLowerCase()} here.
        </p>
      </div>
    </div>
  )
}
