"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkline } from "@/components/app/charts/Sparkline";
import { useDemoStore } from "@/stores/demoStore";

function makePoints(value: number) {
  const base = Math.max(1, value);
  return [
    Math.max(0, base - 2),
    Math.max(0, base - 1),
    base,
    base + 1,
    base + 2,
    Math.max(0, base + 1),
    base + 3,
  ];
}

export default function AnalyticsPage() {
  const projects = useDemoStore((state) => state.projects);
  const tasks = useDemoStore((state) => state.tasks);

  const projectCards = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const published = projectTasks.filter(
        (t) => t.status === "Published",
      ).length;
      const scheduled = projectTasks.filter(
        (t) => t.status === "Scheduled",
      ).length;
      const approvals = projectTasks.filter(
        (t) => t.status === "Needs approval",
      ).length;
      const score = published * 12 + scheduled * 3;

      return {
        id: project.id,
        name: project.name,
        metric: `${published} published, ${scheduled} scheduled`,
        points: makePoints(score),
        change:
          approvals > 0
            ? `${approvals} approvals pending`
            : "No approvals pending",
      };
    });
  }, [projects, tasks]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Analytics
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Performance overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo analytics. Backend metrics and rollups will replace these values.
        </p>
      </div>

      {projectCards.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project, generate a roadmap, then publish to populate
            analytics.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding/create-project"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create project
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {projectCards.map((project) => (
            <Link
              key={project.id}
              href={`/analytics/projects/${encodeURIComponent(project.id)}`}
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
                <Sparkline
                  points={project.points}
                  className="h-10 w-28 text-primary"
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">What to watch</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "First hour comments",
              detail:
                "Early discussion is the strongest predictor of visibility.",
            },
            {
              title: "Removal signals",
              detail: "Track soft removals to protect account health.",
            },
            {
              title: "Time window performance",
              detail: "Compare windows to learn which slots consistently win.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
