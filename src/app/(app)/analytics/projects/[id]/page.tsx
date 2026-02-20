import Link from "next/link";
import { BarMeter } from "@/components/app/charts/BarMeter";
import { SimpleTable } from "@/components/app/tables/SimpleTable";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { computeProjectAnalyticsSnapshot } from "@/lib/analytics/projectSnapshot";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

type Row = {
  permalink: string;
  subreddit: string;
  score: string;
  comments: string;
  status: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

export default async function AnalyticsProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireWorkspaceSession();
  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  let projectId = params.id;
  try {
    projectId = decodeURIComponent(params.id);
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Invalid project id</h1>
        <Link href="/analytics" className="text-sm underline">
          Back to analytics
        </Link>
      </div>
    );
  }

  if (!entitlements.hasAdvancedAnalytics) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Project analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Advanced analytics is available on paid plans.
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">Upgrade required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade your plan to unlock project-level analytics.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              View plans
            </Link>
            <Link
              href="/analytics"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const snapshot = await computeProjectAnalyticsSnapshot(
    session.workspaceId,
    projectId,
  );
  if (!snapshot) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <Link href="/analytics" className="text-sm underline">
          Back to analytics
        </Link>
      </div>
    );
  }

  const rows: Row[] = snapshot.items.map((item) => {
    const latest = item.latestSnapshot;
    return {
      permalink: item.permalink,
      subreddit: `r/${item.subreddit.name}`,
      score: latest ? String(latest.score) : "-",
      comments: latest ? String(latest.numComments) : "-",
      status: latest ? (latest.isRemoved ? "Removed" : "Live") : "No snapshot",
    };
  });

  const attemptedCount =
    snapshot.summary.publishedStatusCount +
    snapshot.summary.failedCount +
    snapshot.summary.cancelledCount;
  const publishSuccess =
    attemptedCount === 0
      ? 0
      : Math.round(
          (snapshot.summary.publishedStatusCount / attemptedCount) * 100,
        );
  const removalRate =
    snapshot.summary.publishedCount === 0
      ? 0
      : Math.round(
          (snapshot.summary.removedCount / snapshot.summary.publishedCount) *
            100,
        );
  const engagementSignal = Math.min(
    100,
    Math.round(snapshot.summary.avgComments * 12),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{snapshot.project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Live project metrics from latest published snapshot data.
          </p>
        </div>
        <Link
          href="/analytics"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Back
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">This week</p>
          <div className="mt-4 space-y-4">
            <BarMeter label="Publish success" value={publishSuccess} />
            <BarMeter label="Removal rate" value={removalRate} />
            <BarMeter label="Engagement signal" value={engagementSignal} />
          </div>
        </div>
        <div className="rounded-[24px] border border-border bg-background/70 p-6 lg:col-span-2">
          <p className="text-sm font-semibold">Published items</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatNumber(snapshot.summary.publishedCount)} published •{" "}
            {formatNumber(snapshot.summary.totalScore)} total score •{" "}
            {formatNumber(snapshot.summary.totalComments)} total comments
          </p>
          <div className="mt-4">
            <SimpleTable<Row>
              columns={[
                {
                  key: "permalink",
                  header: "Permalink",
                  render: (row) => row.permalink,
                },
                {
                  key: "sub",
                  header: "Subreddit",
                  render: (row) => row.subreddit,
                },
                { key: "score", header: "Score", render: (row) => row.score },
                {
                  key: "comments",
                  header: "Comments",
                  render: (row) => row.comments,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => row.status,
                },
              ]}
              getRowKey={(row) => `${row.subreddit}-${row.permalink}`}
              rows={rows}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Project summary</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Scheduled",
              value: formatNumber(snapshot.summary.scheduledCount),
            },
            {
              label: "Publishing",
              value: formatNumber(snapshot.summary.publishingCount),
            },
            {
              label: "Failed",
              value: formatNumber(snapshot.summary.failedCount),
            },
            {
              label: "Cancelled",
              value: formatNumber(snapshot.summary.cancelledCount),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-background/70 px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
