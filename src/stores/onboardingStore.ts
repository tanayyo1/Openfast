import { create } from "zustand";

export type OnboardingStepId = "project" | "reddit" | "roadmap";

export type OnboardingState = {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  completed: boolean;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchProgress: () => Promise<void>;
  completeStep: (step: OnboardingStepId) => Promise<void>;
  isStepCompleted: (step: OnboardingStepId) => boolean;
  getNextStep: () => OnboardingStepId | null;
  reset: () => void;
};

const stepOrder: OnboardingStepId[] = ["project", "reddit", "roadmap"];

function getNextStepFromCompleted(
  completedSteps: OnboardingStepId[],
): OnboardingStepId | null {
  const completedSet = new Set(completedSteps);
  for (const step of stepOrder) {
    if (!completedSet.has(step)) {
      return step;
    }
  }
  return null;
}

const initialState = {
  currentStep: "project" as OnboardingStepId,
  completedSteps: [] as OnboardingStepId[],
  completed: false,
  projectId: null,
  isLoading: true,
  error: null,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  fetchProgress: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/onboarding", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to fetch progress");
      }

      const data = await res.json();

      set({
        currentStep: data.currentStep as OnboardingStepId,
        completedSteps: data.completedSteps as OnboardingStepId[],
        completed: data.completed,
        projectId: data.projectId,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  completeStep: async (step: OnboardingStepId) => {
    const { completedSteps, currentStep } = get();

    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to update progress");
      }

      const data = await res.json();

      const newCompletedSteps = completedSteps.includes(step)
        ? completedSteps
        : [...completedSteps, step];

      set({
        currentStep: data.currentStep as OnboardingStepId,
        completedSteps: newCompletedSteps,
        completed: data.completed,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  isStepCompleted: (step: OnboardingStepId) => {
    const { completedSteps } = get();
    return completedSteps.includes(step);
  },

  getNextStep: () => {
    const { completedSteps } = get();
    return getNextStepFromCompleted(completedSteps);
  },

  reset: () => {
    set(initialState);
  },
}));

export function getStepNumber(step: OnboardingStepId): number {
  return stepOrder.indexOf(step) + 1;
}

export function getTotalSteps(): number {
  return stepOrder.length;
}
