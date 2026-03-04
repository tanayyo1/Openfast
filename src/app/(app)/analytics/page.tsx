import Link from "next/link";
import { Sparkline } from "@/components/app/charts/Sparkline";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { getWorkspaceDashboardData } from "@/lib/analytics/dashboardData";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function trendDelta(points: number[]) {
  if (points.length < 2) return 0;
  return points[points.length - 1] - points[0];
}

export default async function AnalyticsPage() {
  const session = await requireWorkspaceSessionForPage();
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);

  if (!entitlements.hasAdvancedAnalytics) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Performance overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Advanced analytics is available on paid plans.
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">Upgrade required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade your plan to unlock workspace and project analytics.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              View plans
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dashboard = await getWorkspaceDashboardData(session.workspaceId);
  const projectCards = dashboard.byProject.map((project) => {
    const scoreSignal =
      project.totalScore + project.avgComments * 2 + project.scheduledCount;
    const snapshotState = project.publishedCount
      ? `${project.publishedCount} published, ${project.scheduledCount} scheduled`
      : `${project.scheduledCount} scheduled, no publishes yet`;
    const riskLine =
      project.failedCount > 0 || project.removedCount > 0
        ? `${project.failedCount} failed, ${project.removedCount} removed`
        : "No failures or removals";

    return {
      id: project.projectId,
      name: project.projectName,
      metric: snapshotState,
      points: makePoints(Math.round(scoreSignal)),
      change: riskLine,
    };
  });
  const scoreTrendPoints = dashboard.trend.map((point) => point.totalScore);
  const commentTrendPoints = dashboard.trend.map(
    (point) => point.totalComments,
  );
  const removalTrendPoints = dashboard.trend.map((point) => point.removedCount);
  const trendWindowLabel =
    dashboard.trend.length > 0
      ? `${dashboard.trend[0]?.day} → ${dashboard.trend[dashboard.trend.length - 1]?.day}`
      : "No trend window";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Analytics
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Performance overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Source:{" "}
          {dashboard.source === "rollup"
            ? "daily rollup"
            : "live workspace snapshot"}{" "}
          • Generated at {new Date(dashboard.generatedAt).toLocaleString()}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Projects",
            value: formatNumber(dashboard.summary.projectCount),
            detail: "Active projects in workspace",
          },
          {
            label: "Published",
            value: formatNumber(dashboard.summary.publishedCount),
            detail: `${formatNumber(dashboard.summary.removedCount)} removed`,
          },
          {
            label: "Avg score",
            value: formatNumber(dashboard.summary.avgScore),
            detail: `${formatNumber(dashboard.summary.totalScore)} total`,
          },
          {
            label: "Avg comments",
            value: formatNumber(dashboard.summary.avgComments),
            detail: `${formatNumber(dashboard.summary.totalComments)} total`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[24px] border border-border bg-card/80 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
          </div>
        ))}
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

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold">Time-series trend</p>
          <p className="text-xs text-muted-foreground">{trendWindowLabel}</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Daily score",
              value: formatNumber(
                scoreTrendPoints[scoreTrendPoints.length - 1] ?? 0,
              ),
              detail: `${formatNumber(trendDelta(scoreTrendPoints))} net change`,
              points: scoreTrendPoints,
            },
            {
              label: "Daily comments",
              value: formatNumber(
                commentTrendPoints[commentTrendPoints.length - 1] ?? 0,
              ),
              detail: `${formatNumber(trendDelta(commentTrendPoints))} net change`,
              points: commentTrendPoints,
            },
            {
              label: "Daily removals",
              value: formatNumber(
                removalTrendPoints[removalTrendPoints.length - 1] ?? 0,
              ),
              detail: `${formatNumber(trendDelta(removalTrendPoints))} net change`,
              points: removalTrendPoints,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-border bg-background/70 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {metric.label}
              </p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
                <Sparkline
                  points={metric.points}
                  className="h-10 w-28 text-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

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
