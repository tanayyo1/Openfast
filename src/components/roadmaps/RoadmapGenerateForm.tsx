"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OnboardingFlowHeader } from "@/components/onboarding/OnboardingFlowHeader";
import { trackAnalyticsEvent } from "@/lib/analytics/client";

type GenerateProject = {
  id: string;
  name: string;
};

type GenerateAccount = {
  id: string;
  redditUsername: string;
  safetyTier: string;
};

type Props = {
  projects: GenerateProject[];
  accounts: GenerateAccount[];
  initialProjectId: string;
  mode?: "default" | "onboarding";
};

type RoadmapErrorPayload = {
  roadmap?: { id?: string };
  error?: string;
  code?: string;
  details?: {
    requested?: number;
    maxAllowed?: number;
  };
};

function clampHorizon(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(60, Math.round(value)));
}

function recoverProjectSelection(
  currentProjectId: string,
  projects: GenerateProject[],
) {
  if (projects.length === 0) return "";
  const alternate = projects.find((project) => project.id !== currentProjectId);
  return alternate?.id ?? "";
}

function mapRoadmapError(input: {
  status: number;
  payload: RoadmapErrorPayload | null;
}) {
  const code = input.payload?.code;
  if (code === "ROADMAP_HORIZON_LIMIT") {
    const maxAllowed = input.payload?.details?.maxAllowed;
    if (typeof maxAllowed === "number" && Number.isFinite(maxAllowed)) {
      return `Your plan allows up to ${maxAllowed} roadmap days.`;
    }
    return "Roadmap horizon exceeds your plan allowance.";
  }
  if (code === "PROJECT_NOT_FOUND") {
    return "Project no longer exists. Select another project and retry.";
  }
  if (code === "WORKSPACE_REQUIRED" || code === "UNAUTHORIZED") {
    return "Session expired. Please log in again.";
  }
  if (code === "VALIDATION_ERROR") {
    return "Please check project and horizon values.";
  }

  return (
    input.payload?.error ??
    (input.status === 401
      ? "Please log in and retry."
      : input.status === 403
        ? "Your current plan cannot generate this roadmap horizon."
        : "Failed to generate roadmap.")
  );
}

export function RoadmapGenerateForm({
  projects,
  accounts,
  initialProjectId,
  mode = "default",
}: Props) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [horizonDays, setHorizonDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== "") setSelectedProjectId("");
      return;
    }
    const exists = projects.some((project) => project.id === selectedProjectId);
    if (!exists) {
      setSelectedProjectId(projects[0]?.id ?? "");
    }
  }, [projects, selectedProjectId]);

  const canGenerate = useMemo(
    () => Boolean(selectedProjectId) && accounts.length > 0,
    [accounts.length, selectedProjectId],
  );
  const hasProjects = projects.length > 0;
  const connectHref = selectedProjectId
    ? `/onboarding/connect-reddit?projectId=${encodeURIComponent(selectedProjectId)}`
    : "/onboarding/connect-reddit";
  const backHref = mode === "onboarding" ? connectHref : "/roadmaps";

  return (
    <div className="space-y-8">
      {mode === "onboarding" ? (
        <OnboardingFlowHeader
          stepIndex={3}
          projectId={selectedProjectId || null}
          title="Generate your first roadmap"
          description="Create your first execution plan from live project and account context."
        />
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Roadmaps
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Generate roadmap</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a workspace-scoped roadmap from live project and account
            context.
          </p>
        </div>
      )}

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="project">
              Project
            </label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projects.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Create a project first.
              </p>
            ) : null}
            {!hasProjects ? (
              <Link
                href="/onboarding/create-project"
                className="mt-3 inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold"
              >
                Create project
              </Link>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="horizonDays">
              Horizon days
            </label>
            <input
              id="horizonDays"
              type="number"
              min={1}
              max={60}
              value={horizonDays}
              onChange={(event) =>
                setHorizonDays(Number.parseInt(event.target.value, 10) || 1)
              }
              onBlur={() => setHorizonDays((current) => clampHorizon(current))}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Plan limits apply based on your workspace entitlements.
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm font-semibold">Connected Reddit accounts</p>
            <div className="mt-2 rounded-2xl border border-border bg-background/70 p-4">
              {accounts.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No active accounts connected. Connect one to proceed.
                  </p>
                  <Link
                    href={connectHref}
                    className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Connect Reddit account
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      u/{account.redditUsername} (
                      {account.safetyTier.toLowerCase()})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            What gets created
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Tasks paced by day index across the selected horizon</li>
            <li>Recommendation-informed subreddit focus</li>
            <li>Instruction prompts for downstream draft generation</li>
          </ul>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {accounts.length === 0 ? (
            <Link
              href={connectHref}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Connect Reddit account
            </Link>
          ) : null}
          <button
            type="button"
            disabled={!canGenerate || busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError(null);
              try {
                const normalizedHorizonDays = clampHorizon(horizonDays);
                if (normalizedHorizonDays !== horizonDays) {
                  setHorizonDays(normalizedHorizonDays);
                }
                const res = await fetch("/api/roadmaps", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectId: selectedProjectId,
                    horizonDays: normalizedHorizonDays,
                  }),
                });

                let json: RoadmapErrorPayload | null = null;
                try {
                  json = (await res.json()) as RoadmapErrorPayload;
                } catch {
                  json = null;
                }
                const roadmapId = json?.roadmap?.id ?? null;
                if (!res.ok || !roadmapId) {
                  if (
                    json?.code === "PROJECT_NOT_FOUND" &&
                    projects.length > 0
                  ) {
                    setSelectedProjectId((current) => {
                      return recoverProjectSelection(current, projects);
                    });
                  }
                  setError(
                    mapRoadmapError({ status: res.status, payload: json }),
                  );
                  return;
                }

                void trackAnalyticsEvent({
                  eventName: "onboarding_step_roadmap_generated",
                  onceKey: `onboarding_roadmap_generated_${roadmapId}`,
                  properties: {
                    projectId: selectedProjectId,
                    horizonDays: normalizedHorizonDays,
                  },
                });
                void trackAnalyticsEvent({
                  eventName: "onboarding_completed",
                  onceKey: `onboarding_completed_${selectedProjectId}`,
                  properties: {
                    projectId: selectedProjectId,
                    roadmapId,
                    horizonDays: normalizedHorizonDays,
                  },
                });
                router.push(`/roadmaps/${encodeURIComponent(roadmapId)}`);
              } catch {
                setError("Network error while generating roadmap.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Generating..." : "Generate"}
          </button>
          <Link
            href={backHref}
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
