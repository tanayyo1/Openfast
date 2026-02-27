"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DraftListItem = {
  id: string;
  projectId: string;
  taskId: string | null;
  subredditId: string | null;
  type: "POST" | "COMMENT";
  title: string | null;
  body: string;
  variants: unknown;
  status: "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  riskScore: number;
  updatedAt: string;
};

type ProjectListItem = {
  id: string;
  name: string;
};

type TaskDetail = {
  id: string;
  subredditId: string | null;
};

type VariantCandidate = {
  score?: number;
};

function readRiskFromVariants(input: unknown): number | null {
  if (!Array.isArray(input)) return null;
  const first = input.find(
    (item): item is VariantCandidate =>
      typeof item === "object" && item !== null,
  );
  if (!first || typeof first.score !== "number") return null;

  if (first.score <= 1 && first.score >= 0) {
    return Math.round((1 - first.score) * 100);
  }

  if (first.score <= 100 && first.score >= 0) {
    return Math.round(first.score);
  }

  return null;
}

function statusLabel(status: DraftListItem["status"]) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "REVIEWING":
      return "Needs approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

export default function ContentPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [taskSubreddits, setTaskSubreddits] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [draftsRes, projectsRes] = await Promise.all([
          fetch("/api/drafts?limit=50", { cache: "no-store" }),
          fetch("/api/projects?limit=100", { cache: "no-store" }),
        ]);

        const draftsJson = (await draftsRes.json()) as
          | { items?: DraftListItem[]; error?: string }
          | undefined;
        const projectsJson = (await projectsRes.json()) as
          | { items?: ProjectListItem[]; error?: string }
          | undefined;

        if (!draftsRes.ok) {
          throw new Error(draftsJson?.error ?? "Failed to load drafts");
        }
        if (!projectsRes.ok) {
          throw new Error(projectsJson?.error ?? "Failed to load projects");
        }

        const nextDrafts = (draftsJson?.items ?? []).filter(
          (item) => item.status !== "ARCHIVED",
        );

        const projectMap = Object.fromEntries(
          (projectsJson?.items ?? []).map((project) => [
            project.id,
            project.name,
          ]),
        );

        const uniqueTaskIds = Array.from(
          new Set(
            nextDrafts
              .map((item) => item.taskId)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        const taskPairs = await Promise.all(
          uniqueTaskIds.map(async (taskId) => {
            try {
              const res = await fetch(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                {
                  cache: "no-store",
                },
              );
              if (!res.ok) return [taskId, ""] as const;
              const json = (await res.json()) as { task?: TaskDetail };
              return [taskId, json.task?.subredditId ?? ""] as const;
            } catch {
              return [taskId, ""] as const;
            }
          }),
        );

        if (cancelled) return;

        setDrafts(nextDrafts);
        setProjects(projectMap);
        setTaskSubreddits(Object.fromEntries(taskPairs));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    return drafts.map((draft) => {
      const variantRisk = readRiskFromVariants(draft.variants);
      return {
        id: draft.id,
        title:
          draft.title?.trim() || draft.body.slice(0, 80) || "Untitled draft",
        status: statusLabel(draft.status),
        project: projects[draft.projectId] ?? "Unknown project",
        subreddit:
          (draft.taskId ? taskSubreddits[draft.taskId] : "") ||
          draft.subredditId ||
          "general",
        risk: variantRisk ?? draft.riskScore,
      };
    });
  }, [drafts, projects, taskSubreddits]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Content
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Drafts and variants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate variants, edit, then request approval before scheduling.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/approvals"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Approvals
          </Link>
          <Link
            href="/roadmaps"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View roadmaps
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-destructive/30 bg-destructive/10 p-6">
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm text-muted-foreground">Loading drafts...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card/80 p-8">
          <p className="text-sm font-semibold">No drafts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a task and generate a draft to start.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/roadmaps"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to roadmaps
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((draft) => (
            <Link
              key={draft.id}
              href={`/content/drafts/${encodeURIComponent(draft.id)}`}
              className="rounded-[24px] border border-border bg-card/80 p-6 transition hover:border-foreground/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{draft.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {draft.project}
                    <span className="mx-2 text-muted-foreground/40">|</span>
                    {draft.subreddit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {draft.status}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Risk: {draft.risk}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Quality checklist</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Avoid hard CTAs",
              detail: "Keep language helpful and discussion-led.",
            },
            {
              title: "Respect rules",
              detail: "Match title format, link limits, and flair.",
            },
            {
              title: "Prevent duplicates",
              detail: "Do not re-post similar drafts across subs.",
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
