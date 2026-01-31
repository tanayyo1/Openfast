export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-40 rounded-full bg-card/60 animate-pulse" />
      <div className="h-10 w-72 rounded-full bg-card/60 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 rounded-[24px] border border-border bg-card/50 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 rounded-[24px] border border-border bg-card/50 animate-pulse" />
    </div>
  )
}
