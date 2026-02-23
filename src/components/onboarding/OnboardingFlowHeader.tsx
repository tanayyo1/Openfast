"use client";

import Link from "next/link";

type Props = {
  stepIndex: 1 | 2 | 3;
  title: string;
  description: string;
  projectId?: string | null;
};

type FlowStep = {
  id: "project" | "reddit" | "roadmap";
  label: string;
};

const FLOW_STEPS: FlowStep[] = [
  { id: "project", label: "Create project" },
  { id: "reddit", label: "Connect Reddit" },
  { id: "roadmap", label: "Generate roadmap" },
];

function buildStepHref(stepId: FlowStep["id"], projectId: string | null) {
  if (stepId === "project") return "/onboarding/create-project";
  if (stepId === "reddit") {
    if (!projectId) return "/onboarding/connect-reddit";
    return `/onboarding/connect-reddit?projectId=${encodeURIComponent(projectId)}`;
  }
  if (!projectId) return "/onboarding/generate-roadmap";
  return `/onboarding/generate-roadmap?projectId=${encodeURIComponent(projectId)}`;
}

export function OnboardingFlowHeader({
  stepIndex,
  title,
  description,
  projectId = null,
}: Props) {
  const progressWidth = `${Math.round((stepIndex / FLOW_STEPS.length) * 100)}%`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Activation flow
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          Step {stepIndex} of {FLOW_STEPS.length}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/80 p-4">
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: progressWidth }}
          />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {FLOW_STEPS.map((step, idx) => {
            const itemStep = idx + 1;
            const isComplete = itemStep < stepIndex;
            const isCurrent = itemStep === stepIndex;
            const href = buildStepHref(step.id, projectId);
            const baseClass =
              "rounded-full border px-3 py-2 text-xs font-semibold text-center";

            if (isCurrent) {
              return (
                <span
                  key={step.id}
                  className={`${baseClass} border-primary/50 bg-primary/10 text-primary`}
                >
                  {itemStep}. {step.label}
                </span>
              );
            }

            if (isComplete) {
              return (
                <Link
                  key={step.id}
                  href={href}
                  className={`${baseClass} border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500`}
                >
                  {itemStep}. {step.label}
                </Link>
              );
            }

            return (
              <span
                key={step.id}
                className={`${baseClass} border-border bg-background text-muted-foreground`}
              >
                {itemStep}. {step.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
