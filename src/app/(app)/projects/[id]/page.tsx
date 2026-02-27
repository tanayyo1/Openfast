import Link from "next/link";
import {
  goalsToList,
  loadProjectDetailPageData,
} from "@/lib/dashboardProjectsPageData";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let projectId = "";
  try {
    projectId = decodeURIComponent(params.id ?? "");
  } catch {
    projectId = "";
  }

  const {
    project,
    roadmapCount,
    pendingApprovals,
    scheduledCount,
    latestRoadmap,
  } = await loadProjectDetailPageData(projectId);

  if (!project) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <Link href="/projects" className="text-sm underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Project
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Goals:{" "}
            {goalsToList(project.goals).length > 0
              ? goalsToList(project.goals).join(", ")
              : "Not set"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${encodeURIComponent(project.id)}/settings`}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Settings
          </Link>
          <Link
            href="/roadmaps/generate"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Generate roadmap
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Roadmaps", value: String(roadmapCount) },
          { label: "Pending approvals", value: String(pendingApprovals) },
          { label: "Scheduled", value: String(scheduledCount) },
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

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Quick links</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/content"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Drafts
          </Link>
          <Link
            href="/approvals"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Approvals
          </Link>
          <Link
            href="/scheduling"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Scheduling
          </Link>
          <Link
            href="/analytics"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Analytics
          </Link>
          <Link
            href={`/brand-monitoring?projectId=${encodeURIComponent(project.id)}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Brand Monitoring
          </Link>
        </div>
      </div>

      {latestRoadmap ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Latest roadmap</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Starts {latestRoadmap.startDate.toLocaleDateString()} for{" "}
            {latestRoadmap.horizonDays} days
          </p>
          <div className="mt-4">
            <Link
              href={`/roadmaps/${encodeURIComponent(latestRoadmap.id)}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Open roadmap
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
