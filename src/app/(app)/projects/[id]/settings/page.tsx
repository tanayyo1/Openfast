"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useDemoStore } from "@/stores/demoStore";

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ? decodeURIComponent(params.id) : "";

  const project = useDemoStore((state) =>
    state.projects.find((p) => p.id === projectId),
  );

  const goalsText = useMemo(() => {
    if (!project) return "Not set";
    return project.goals.length > 0 ? project.goals.join(", ") : "Not set";
  }, [project]);

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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Project settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo-only settings. Backend updates will replace this.
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
            {project.brandVoice || "Not set"}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold">Goals</p>
          <p className="mt-2 text-sm text-muted-foreground">{goalsText}</p>
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
