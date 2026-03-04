import type { OnboardingStep } from "@/lib/onboardingProgress";

export type GuidedOnboardingItem = OnboardingStep & {
  etaMinutes: number;
  checkpoint: string;
  hint: string;
};

const STEP_ETA_MINUTES: Record<OnboardingStep["id"], number> = {
  project: 2,
  reddit: 3,
  roadmap: 2,
};

const STEP_CHECKPOINT: Record<OnboardingStep["id"], string> = {
  project: "Project context saved with goals and brand voice.",
  reddit: "At least one active Reddit account is connected.",
  roadmap: "First roadmap generated and ready for execution.",
};

function hintForStep(step: OnboardingStep) {
  if (step.status === "complete") {
    if (step.id === "project") return "You can add more projects anytime.";
    if (step.id === "reddit")
      return "You can connect additional accounts later in Account Health.";
    return "Move to execution: content, approvals, and scheduling.";
  }

  if (step.status === "current") {
    if (step.id === "project")
      return "Add product basics and one clear goal to continue.";
    if (step.id === "reddit")
      return "Connect one account with OAuth or local mode to unlock roadmap.";
    return "Generate your roadmap to unlock scheduling and analytics.";
  }

  if (step.id === "project")
    return "Workspace setup is still syncing. Refresh when ready.";
  if (step.id === "reddit") return "Create a project before linking accounts.";
  return "Complete project + account steps before generating roadmap.";
}

export function buildGuidedOnboardingItems(
  steps: OnboardingStep[],
): GuidedOnboardingItem[] {
  return steps.map((step) => ({
    ...step,
    etaMinutes: STEP_ETA_MINUTES[step.id],
    checkpoint: STEP_CHECKPOINT[step.id],
    hint: hintForStep(step),
  }));
}
