export default function ProjectsLoadingPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Projects
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Loading projects</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a preview route for a loading state.
        </p>
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 rounded-[24px] border border-border bg-card/50 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
