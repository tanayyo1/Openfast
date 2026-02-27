import Link from "next/link";
import {
  brandVoiceToText,
  goalsToList,
  loadProjectSettingsPageData,
} from "@/lib/dashboardProjectsPageData";

export default async function ProjectSettingsPage({
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
  const project = await loadProjectSettingsPageData(projectId);

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

  const goals = goalsToList(project.goals);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Project settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Workspace-scoped project configuration snapshot.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Project name</p>
            <p className="mt-2 text-sm text-muted-foreground">{project.name}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product URL</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {project.url ?? "Not provided"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold">Description</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold">Brand voice</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {brandVoiceToText(project.brandVoice)}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold">Goals</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {goals.length > 0 ? goals.join(", ") : "Not set"}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/projects/${encodeURIComponent(project.id)}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back
          </Link>
          <Link
            href="/roadmaps/generate"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Generate roadmap
          </Link>
        </div>
      </div>
    </div>
  );
}
