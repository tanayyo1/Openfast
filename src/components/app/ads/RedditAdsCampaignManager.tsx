"use client";

import { useMemo, useState } from "react";

type ProjectOption = {
  id: string;
  name: string;
};

type RedditAccountOption = {
  id: string;
  redditUsername: string;
};

type CampaignView = {
  id: string;
  projectId: string;
  redditAccountId: string | null;
  name: string;
  objective: "AWARENESS" | "TRAFFIC" | "ENGAGEMENT" | "LEAD_GEN" | "CONVERSIONS";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  dailyBudgetCents: number;
  lifetimeBudgetCents: number | null;
  targetSubreddits: string[];
  targetCountries: string[];
  headline: string | null;
  body: string | null;
  destinationUrl: string | null;
  launchedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  redditAccount: { id: string; redditUsername: string } | null;
};

type Props = {
  projects: ProjectOption[];
  redditAccounts: RedditAccountOption[];
  initialCampaigns: CampaignView[];
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function statusTone(status: CampaignView["status"]) {
  if (status === "ACTIVE") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (status === "PAUSED") return "border-amber-300 bg-amber-50 text-amber-700";
  if (status === "COMPLETED") return "border-sky-300 bg-sky-50 text-sky-700";
  if (status === "ARCHIVED") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-border bg-background text-muted-foreground";
}

export function RedditAdsCampaignManager({
  projects,
  redditAccounts,
  initialCampaigns,
}: Props) {
  const hasProjects = projects.length > 0;
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    projectId: projects[0]?.id ?? "",
    redditAccountId: "",
    name: "",
    objective: "TRAFFIC" as CampaignView["objective"],
    dailyBudgetUsd: "25",
    lifetimeBudgetUsd: "",
    targetSubreddits: "startups",
    targetCountries: "US",
    headline: "",
    body: "",
    destinationUrl: "",
    ctaText: "",
  });

  const byStatus = useMemo(() => {
    return {
      active: campaigns.filter((c) => c.status === "ACTIVE").length,
      draft: campaigns.filter((c) => c.status === "DRAFT").length,
      paused: campaigns.filter((c) => c.status === "PAUSED").length,
      archived: campaigns.filter((c) => c.status === "ARCHIVED").length,
    };
  }, [campaigns]);

  async function updateCampaignStatus(campaignId: string, status: CampaignView["status"]) {
    setLoadingId(campaignId);
    setError(null);
    try {
      const res = await fetch(`/api/reddit/ads/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as {
        campaign?: CampaignView;
        error?: string;
      };
      if (!res.ok || !json.campaign) {
        setError(json.error ?? "Failed to update campaign status");
        return;
      }
      setCampaigns((prev) => prev.map((item) => (item.id === campaignId ? json.campaign! : item)));
    } catch {
      setError("Request failed while updating campaign status");
    } finally {
      setLoadingId(null);
    }
  }

  async function createCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!hasProjects) {
      setError("Create a project first before creating an ad campaign.");
      return;
    }

    setIsCreating(true);

    const dailyBudgetCents = Math.round(Number(createForm.dailyBudgetUsd) * 100);
    const lifetimeBudgetCentsRaw = createForm.lifetimeBudgetUsd.trim();
    const lifetimeBudgetCents =
      lifetimeBudgetCentsRaw.length > 0
        ? Math.round(Number(lifetimeBudgetCentsRaw) * 100)
        : null;

    try {
      const res = await fetch("/api/reddit/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: createForm.projectId,
          redditAccountId: createForm.redditAccountId || null,
          name: createForm.name,
          objective: createForm.objective,
          dailyBudgetCents,
          lifetimeBudgetCents,
          targetSubreddits: createForm.targetSubreddits
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          targetCountries: createForm.targetCountries
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          headline: createForm.headline || null,
          body: createForm.body || null,
          destinationUrl: createForm.destinationUrl || null,
          ctaText: createForm.ctaText || null,
        }),
      });
      const json = (await res.json()) as {
        campaign?: CampaignView;
        error?: string;
      };
      if (!res.ok || !json.campaign) {
        setError(json.error ?? "Failed to create campaign");
        return;
      }

      setCampaigns((prev) => [json.campaign!, ...prev]);
      setCreateForm((prev) => ({
        ...prev,
        name: "",
        lifetimeBudgetUsd: "",
        headline: "",
        body: "",
        destinationUrl: "",
        ctaText: "",
      }));
    } catch {
      setError("Request failed while creating campaign");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold">{byStatus.active}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Draft</p>
          <p className="mt-1 text-2xl font-semibold">{byStatus.draft}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Paused</p>
          <p className="mt-1 text-2xl font-semibold">{byStatus.paused}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Archived</p>
          <p className="mt-1 text-2xl font-semibold">{byStatus.archived}</p>
        </div>
      </div>

      <form
        onSubmit={createCampaign}
        className="rounded-[24px] border border-border bg-card/80 p-6"
      >
        <p className="text-sm font-semibold">Create ad campaign</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Campaign name"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <select
            value={createForm.objective}
            onChange={(e) =>
              setCreateForm((prev) => ({
                ...prev,
                objective: e.target.value as CampaignView["objective"],
              }))
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="TRAFFIC">Traffic</option>
            <option value="CONVERSIONS">Conversions</option>
            <option value="AWARENESS">Awareness</option>
            <option value="ENGAGEMENT">Engagement</option>
            <option value="LEAD_GEN">Lead gen</option>
          </select>
          <select
            value={createForm.projectId}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, projectId: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            disabled={!hasProjects}
            required
          >
            {!hasProjects ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
          <select
            value={createForm.redditAccountId}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, redditAccountId: e.target.value }))
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">No account selected</option>
            {redditAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                u/{account.redditUsername}
              </option>
            ))}
          </select>
          <input
            value={createForm.dailyBudgetUsd}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, dailyBudgetUsd: e.target.value }))}
            placeholder="Daily budget USD (e.g. 25)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <input
            value={createForm.lifetimeBudgetUsd}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, lifetimeBudgetUsd: e.target.value }))
            }
            placeholder="Lifetime budget USD (optional)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={createForm.targetSubreddits}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, targetSubreddits: e.target.value }))
            }
            placeholder="Target subreddits (comma separated)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
            required
          />
          <input
            value={createForm.targetCountries}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, targetCountries: e.target.value }))
            }
            placeholder="Target countries (comma separated ISO2, e.g. US,CA)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={createForm.headline}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, headline: e.target.value }))}
            placeholder="Ad headline (required to activate)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={createForm.body}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Ad body copy (required to activate)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
            rows={3}
          />
          <input
            value={createForm.destinationUrl}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, destinationUrl: e.target.value }))
            }
            placeholder="Destination URL (required to activate)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={createForm.ctaText}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, ctaText: e.target.value }))}
            placeholder="CTA text (optional)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isCreating || !hasProjects}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {!hasProjects
            ? "Create a project first"
            : isCreating
              ? "Creating..."
              : "Create campaign"}
        </button>
      </form>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No ad campaigns yet.
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-[24px] border border-border bg-card/80 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{campaign.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaign.project.name} • {campaign.objective} • {formatUsd(campaign.dailyBudgetCents)}
                    /day
                    {campaign.lifetimeBudgetCents != null
                      ? ` • ${formatUsd(campaign.lifetimeBudgetCents)} lifetime`
                      : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Targets: {campaign.targetSubreddits.map((s) => `r/${s}`).join(", ")}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
                  <button
                    type="button"
                    disabled={loadingId === campaign.id}
                    onClick={() => updateCampaignStatus(campaign.id, "ACTIVE")}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    Activate
                  </button>
                )}
                {campaign.status === "ACTIVE" && (
                  <button
                    type="button"
                    disabled={loadingId === campaign.id}
                    onClick={() => updateCampaignStatus(campaign.id, "PAUSED")}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                  >
                    Pause
                  </button>
                )}
                {campaign.status === "ACTIVE" && (
                  <button
                    type="button"
                    disabled={loadingId === campaign.id}
                    onClick={() => updateCampaignStatus(campaign.id, "COMPLETED")}
                    className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                  >
                    Complete
                  </button>
                )}
                {campaign.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    disabled={loadingId === campaign.id}
                    onClick={() => updateCampaignStatus(campaign.id, "ARCHIVED")}
                    className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
