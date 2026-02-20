import Link from "next/link";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { prisma } from "@/lib/prisma";
import {
  type MentionSentiment,
  type MentionUrgency,
  buildProjectBrandMonitoringSnapshot,
} from "@/lib/brandMonitoring/monitor";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

function toneForUrgency(urgency: MentionUrgency) {
  if (urgency === "HIGH") return "border-red-300 bg-red-50 text-red-700";
  if (urgency === "MEDIUM") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

function toneForSentiment(sentiment: MentionSentiment) {
  if (sentiment === "NEGATIVE") return "text-red-600";
  if (sentiment === "POSITIVE") return "text-emerald-600";
  return "text-muted-foreground";
}

export default async function BrandMonitoringPage({
  searchParams,
}: {
  searchParams?: { projectId?: string | string[] };
}) {
  const session = await requireWorkspaceSessionForPage();
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (!entitlements.hasSmartFinder) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Brand monitoring
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Smart Finder required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Brand monitoring is available on paid plans with Smart Finder enabled.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          View pricing
        </Link>
      </div>
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
    },
    take: 50,
  });

  const requestedProjectId = Array.isArray(searchParams?.projectId)
    ? searchParams?.projectId[0]
    : searchParams?.projectId;
  const selectedProjectId =
    requestedProjectId && projects.some((p) => p.id === requestedProjectId)
      ? requestedProjectId
      : projects[0]?.id ?? null;

  const snapshot = selectedProjectId
    ? await buildProjectBrandMonitoringSnapshot({
        workspaceId: session.workspaceId,
        projectId: selectedProjectId,
        lookbackDays: 14,
        limit: 12,
      })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Brand monitoring
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Track brand mentions in the wild</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Watch subreddit thread titles for brand and goal-related keywords, then prioritize
            response opportunities.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open opportunities
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project first to start tracking brand mentions.
          </p>
          <Link
            href="/onboarding/create-project"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create project
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-[24px] border border-border bg-card/80 p-6">
            <p className="text-sm font-semibold">Project scope</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/brand-monitoring?projectId=${encodeURIComponent(project.id)}`}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    project.id === selectedProjectId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {project.name}
                </Link>
              ))}
            </div>
          </div>

          {snapshot ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-border bg-card/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Mentions found
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{snapshot.count}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Last {snapshot.lookbackDays} days</p>
                </div>
                <div className="rounded-[24px] border border-border bg-card/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Urgent mentions
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{snapshot.summary.high}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {snapshot.summary.medium} medium, {snapshot.summary.low} low
                  </p>
                </div>
                <div className="rounded-[24px] border border-border bg-card/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Sentiment mix
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{snapshot.summary.negative}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Negative, {snapshot.summary.neutral} neutral, {snapshot.summary.positive} positive
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-border bg-background/70 p-6">
                <p className="text-sm font-semibold">Keyword matches</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {snapshot.keywords.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No project keywords detected.</span>
                  ) : (
                    snapshot.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                {snapshot.items.length === 0 ? (
                  <div className="rounded-[24px] border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                    No matching mentions in the current lookback window.
                  </div>
                ) : (
                  snapshot.items.map((item) => (
                    <a
                      key={item.id}
                      href={item.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{item.title}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            r/{item.subredditName}
                            <span className="mx-2 text-muted-foreground/40">|</span>
                            by u/{item.author}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneForUrgency(
                              item.urgency,
                            )}`}
                          >
                            {item.urgency}
                          </span>
                          <span
                            className={`rounded-full border border-border px-3 py-1 text-xs font-semibold ${toneForSentiment(
                              item.sentiment,
                            )}`}
                          >
                            {item.sentiment}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Matched: {item.matchedKeywords.join(", ")}
                        <span className="mx-2 text-muted-foreground/40">|</span>
                        Score {item.mentionScore}
                      </p>
                    </a>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-border bg-card/80 p-6 text-sm text-muted-foreground">
              Unable to load monitoring snapshot for this project.
            </div>
          )}
        </>
      )}
    </div>
  );
}
