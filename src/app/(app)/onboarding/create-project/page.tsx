"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OnboardingFlowHeader } from "@/components/onboarding/OnboardingFlowHeader";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { normalizeProjectUrlInput } from "@/lib/projects/url";
import {
  buildProjectPrefillFromPostGenerator,
  clearPostGeneratorHandoff,
  readPostGeneratorHandoff,
} from "@/lib/publicToolHandoff";

const goalOptions = [
  {
    label: "Traffic",
    description: "Send qualified visits to your landing page.",
  },
  {
    label: "Feedback",
    description: "Validate positioning and roadmap decisions.",
  },
  { label: "Leads", description: "Collect demos and signups without spam." },
  { label: "Community", description: "Build long-term presence and trust." },
];

export default function CreateProjectPage() {
  const router = useRouter();
  const handoffLoadedRef = useRef(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    return name.trim().length > 1 && description.trim().length > 10;
  }, [name, description]);

  useEffect(() => {
    if (handoffLoadedRef.current) return;
    handoffLoadedRef.current = true;

    const handoff = readPostGeneratorHandoff();
    if (!handoff) return;

    const prefill = buildProjectPrefillFromPostGenerator(handoff);
    setName((current) => (current.trim().length > 0 ? current : prefill.name));
    setDescription((current) =>
      current.trim().length > 0 ? current : prefill.description,
    );
    setBrandVoice((current) =>
      current.trim().length > 0 ? current : prefill.brandVoice,
    );
    setSelectedGoals((current) =>
      current.length > 0 ? current : [prefill.primaryGoal],
    );

    setHandoffNotice(
      `Imported draft context from post generator (${handoff.source === "openai" ? "OpenAI" : "fallback"}). Review and save.`,
    );
  }, []);

  async function saveProject() {
    setError(null);

    const cleanName = name.trim();
    const cleanDescription = description.trim();
    const normalizedUrl = normalizeProjectUrlInput(url);
    const hasUrlInput = url.trim().length > 0;

    if (!isValid) {
      setError("Please provide a project name and a short description.");
      return;
    }
    if (hasUrlInput && !normalizedUrl) {
      setError("Use a valid URL like https://example.com.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          description: cleanDescription,
          url: normalizedUrl,
          goals: {
            primary: selectedGoals[0]?.toLowerCase() ?? "traffic",
            targets: selectedGoals.slice(1).map((goal) => goal.toLowerCase()),
            kpis: [],
          },
          brandVoice: {
            tone: brandVoice.trim() || "neutral",
            do: [],
            dont: [],
          },
          niche: "general",
        }),
      });

      const json = (await res.json()) as {
        project?: { id: string };
        error?: string;
        code?: string;
        details?: {
          fieldErrors?: Record<string, string[] | undefined>;
          formErrors?: string[];
        };
      };

      if (!res.ok || !json.project) {
        if (json.code === "VALIDATION_ERROR") {
          const firstFieldError = json.details?.fieldErrors
            ? (Object.values(json.details.fieldErrors)
                .flatMap((messages) => messages ?? [])
                .find(
                  (message): message is string =>
                    typeof message === "string" && message.trim().length > 0,
                ) ?? null)
            : null;
          const firstFormError =
            json.details?.formErrors?.find(
              (message) =>
                typeof message === "string" && message.trim().length > 0,
            ) ?? null;
          setError(
            firstFieldError ??
              firstFormError ??
              "Please check your inputs and try again.",
          );
        } else if (json.code === "QUOTA_EXCEEDED_PROJECTS") {
          setError("Project limit reached for your current plan.");
        } else if (json.code === "UNAUTHORIZED") {
          setError("Session expired. Please login again.");
        } else {
          setError(json.error ?? "Failed to save project. Try again.");
        }
        return;
      }

      void trackAnalyticsEvent({
        eventName: "onboarding_step_project_created",
        onceKey: `onboarding_project_created_${json.project.id}`,
        properties: {
          hasUrl: Boolean(normalizedUrl),
          selectedGoals: selectedGoals.length,
        },
      });
      clearPostGeneratorHandoff();
      router.push(
        `/onboarding/connect-reddit?projectId=${encodeURIComponent(json.project.id)}`,
      );
    } catch {
      setError("Network issue while saving project. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <OnboardingFlowHeader
        stepIndex={1}
        title="Create your first project"
        description="Add core details so we can recommend subreddits and safe posting cadence."
      />

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        {handoffNotice ? (
          <p className="mb-4 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            {handoffNotice}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pulse CRM"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="url">
              Product URL (optional)
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://yourproduct.com"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="desc">
            Product description
          </label>
          <textarea
            id="desc"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what you do, who it helps, and why it is different."
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="voice">
            Brand voice
          </label>
          <textarea
            id="voice"
            rows={4}
            value={brandVoice}
            onChange={(event) => setBrandVoice(event.target.value)}
            placeholder="Helpful, concise, and honest. No hype."
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Goals</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {goalOptions.map((goal) => {
              const checked = selectedGoals.includes(goal.label);
              return (
                <label
                  key={goal.label}
                  className="flex items-start gap-3 rounded-[20px] border border-border bg-background/70 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedGoals((prev) =>
                        checked
                          ? prev.filter((item) => item !== goal.label)
                          : [...prev, goal.label],
                      );
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {goal.label}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {goal.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Safety pacing
            </p>
            <p className="mt-2 text-sm font-semibold">
              Conservative by default
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              New accounts start with light posting and heavier commenting.
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Compliance notes
            </p>
            <p className="mt-2 text-sm font-semibold">
              Human approval required
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Drafts must be approved before scheduling to protect your account.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-muted-foreground">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!isValid || isSaving}
            onClick={saveProject}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save project"}
          </button>
          <Link
            href="/onboarding"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
