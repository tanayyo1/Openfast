import Link from "next/link";
import {
  loadRoadmapDetailPageData,
  roadmapWindowLabel,
} from "@/lib/roadmapsPageData";

export default async function RoadmapDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let roadmapId = "";
  try {
    roadmapId = decodeURIComponent(params.id ?? "");
  } catch {
    roadmapId = "";
  }

  const data = await loadRoadmapDetailPageData(roadmapId);

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Roadmap
        </p>
        <h1 className="text-3xl font-semibold">Roadmap not found</h1>
        <p className="text-sm text-muted-foreground">
          Generate a new roadmap to continue.
        </p>
        <Link
          href="/roadmaps/generate"
          className="inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Generate roadmap
        </Link>
      </div>
    );
  }

  const { roadmap, tasks, pendingApprovals, scheduledCount, failureCount } =
    data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Roadmap
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {roadmap.project.name} roadmap v{roadmap.version}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {roadmapWindowLabel(roadmap.startDate, roadmap.horizonDays)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/roadmaps"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back
          </Link>
          <Link
            href="/content"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Drafts
          </Link>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Tasks</p>
        {tasks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No tasks found.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${encodeURIComponent(task.id)}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4 transition hover:border-foreground/40"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {task.type} in{" "}
                    {task.subreddit ? `r/${task.subreddit.name}` : "general"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Day {task.dayIndex}
                    {typeof task.estimatedTime === "number"
                      ? ` | ${task.estimatedTime} min`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {task.status.toLowerCase()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Drafts pending approval", value: String(pendingApprovals) },
          { label: "Scheduled items", value: String(scheduledCount) },
          { label: "Failures", value: String(failureCount) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-border bg-card/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
