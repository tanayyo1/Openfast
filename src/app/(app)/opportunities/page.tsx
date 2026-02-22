"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ProjectItem = {
  id: string;
  name: string;
};

type OpportunityItem = {
  id: string;
  subredditId: string;
  subredditName: string;
  subredditTitle: string;
  title: string;
  permalink: string;
  author: string;
  opportunityScore: number;
  relevanceScore: number;
  velocityScore: number;
  riskScore: number;
  velocity: string;
  risk: string;
};

type OpportunitiesResponse = {
  count: number;
  items: OpportunityItem[];
};

type CreateFromOpportunityResponse = {
  task?: { id: string };
  draft?: { id: string };
  warning?: string;
  error?: string;
  code?: string;
};

function scorePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function OpportunitiesPage() {
  const feedRequestCounter = useRef(0);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOpportunityId, setActingOpportunityId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasProjects = projects.length > 0;

  async function loadProjects() {
    setLoadingProjects(true);
    setError(null);

    try {
      const res = await fetch("/api/projects?limit=100", { cache: "no-store" });
      const json = (await res.json()) as
        | { items?: ProjectItem[]; error?: string }
        | undefined;

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load projects");
      }

      const nextProjects = json?.items ?? [];
      setProjects(nextProjects);
      setSelectedProjectId((current) => {
        if (!current) return nextProjects[0]?.id || "";
        const exists = nextProjects.some((project) => project.id === current);
        return exists ? current : nextProjects[0]?.id || "";
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load projects";
      setError(message);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadFeed(projectId: string, opts?: { silent?: boolean }) {
    if (!projectId) {
      setItems([]);
      return;
    }

    setError(null);
    if (opts?.silent) {
      setRefreshing(true);
    } else {
      setLoadingFeed(true);
    }
    const requestId = ++feedRequestCounter.current;

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/opportunities?limit=20&minScore=0.15`,
        { cache: "no-store" },
      );

      const json = (await res.json()) as
        | (OpportunitiesResponse & { error?: string; code?: string })
        | undefined;

      if (!res.ok) {
        if (json?.code === "SMART_FINDER_REQUIRED") {
          throw new Error(
            "Smart Finder is required on your current plan to view opportunities.",
          );
        }
        throw new Error(json?.error ?? "Failed to load opportunities");
      }

      if (requestId !== feedRequestCounter.current) return;
      setItems(json?.items ?? []);
      setError(null);
    } catch (err) {
      if (requestId !== feedRequestCounter.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load opportunities";
      setItems([]);
      setError(message);
    } finally {
      if (requestId !== feedRequestCounter.current) return;
      setLoadingFeed(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadFeed(selectedProjectId);
  }, [selectedProjectId]);

  async function createFromOpportunity(opportunityId: string) {
    if (!selectedProjectId || actingOpportunityId) return;
    const projectIdAtAction = selectedProjectId;

    setActingOpportunityId(opportunityId);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectIdAtAction,
          opportunityId,
          variantCount: 3,
          tone: "helpful",
          length: "short",
        }),
      });

      const json = (await res.json()) as CreateFromOpportunityResponse;

      if (!res.ok) {
        if (
          json.code === "OPPORTUNITY_NOT_AVAILABLE" ||
          json.code === "OPPORTUNITY_NOT_FOUND"
        ) {
          setError("This opportunity is no longer available. Refreshing feed.");
          if (selectedProjectId === projectIdAtAction) {
            await loadFeed(projectIdAtAction, { silent: true });
          }
          return;
        }
        if (json.code === "ACTIVE_ROADMAP_REQUIRED") {
          setError(
            "No active roadmap found for this project. Generate a roadmap first.",
          );
          return;
        }
        if (json.code === "RECOMMENDATIONS_REQUIRED") {
          setError(
            "No subreddit recommendations found. Run recommendations first.",
          );
          return;
        }
        setError(json.error ?? "Failed to create draft from opportunity");
        return;
      }

      const destination =
        json.draft?.id != null
          ? `/content/drafts/${encodeURIComponent(json.draft.id)}`
          : json.task?.id != null
            ? `/tasks/${encodeURIComponent(json.task.id)}`
            : null;

      setNotice(
        json.warning
          ? `${json.warning} You can continue editing manually.`
          : "Comment draft created from opportunity.",
      );

      if (selectedProjectId === projectIdAtAction) {
        setItems((current) =>
          current.filter((item) => item.id !== opportunityId),
        );
      }

      if (destination) {
        window.location.href = destination;
      }
    } catch {
      setError("Request failed while creating a draft from this opportunity.");
    } finally {
      setActingOpportunityId(null);
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Smart post finder
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Comment opportunities</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Discover high-signal threads and create value-first comment drafts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/health"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to health
          </Link>
          <button
            type="button"
            disabled={!selectedProjectId || refreshing || loadingFeed}
            onClick={() => {
              void loadFeed(selectedProjectId, { silent: true });
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh feed"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {notice}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Project scope</p>
        {loadingProjects ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Loading projects...
          </p>
        ) : !hasProjects ? (
          <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold">No projects yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a project first to unlock opportunity discovery.
            </p>
            <Link
              href="/onboarding/create-project"
              className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create project
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <select
              value={selectedProjectId}
              disabled={actingOpportunityId != null}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60 md:w-96"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loadingFeed ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm text-muted-foreground">
            Loading opportunities...
          </p>
        </div>
      ) : hasProjects && selectedProjectId && sorted.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No opportunities found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try again later or improve project recommendations and risk filters.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/roadmaps/generate"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Generate roadmap
            </Link>
            <Link
              href="/brand-monitoring"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open brand monitoring
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="rounded-[24px] border border-border bg-card/80 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    r/{item.subredditName} • u/{item.author}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                      Score {scorePercent(item.opportunityScore)}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                      Velocity {item.velocity}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                      Risk {item.risk}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={item.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                  >
                    Open thread
                  </a>
                  <button
                    type="button"
                    disabled={actingOpportunityId != null}
                    onClick={() => {
                      void createFromOpportunity(item.id);
                    }}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {actingOpportunityId === item.id
                      ? "Creating..."
                      : "Create comment draft"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
