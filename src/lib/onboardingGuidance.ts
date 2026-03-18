import type { OnboardingStep } from "@/lib/onboardingProgress";

export type GuidedOnboardingItem = OnboardingStep & {
  etaMinutes: number;
  checkpoint: string;
  hint: string;
};

const STEP_ETA_MINUTES: Record<OnboardingStep["id"], number> = {
  project: 2,
  roadmap: 2,
};

const STEP_CHECKPOINT: Record<OnboardingStep["id"], string> = {
  project: "Project context saved with goals and brand voice.",
  roadmap: "First roadmap generated and ready for monitoring.",
};

function hintForStep(step: OnboardingStep) {
  if (step.status === "complete") {
    if (step.id === "project") return "You can add more projects anytime.";
    return "Head to Monitor to start tracking subreddits and drafting replies.";
  }

  if (step.status === "current") {
    if (step.id === "project")
      return "Add product basics and one clear goal to continue.";
    return "Generate your roadmap to start monitoring and creating content.";
  }

  if (step.id === "project")
    return "Workspace setup is still syncing. Refresh when ready.";
  return "Create a project before generating a roadmap.";
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
