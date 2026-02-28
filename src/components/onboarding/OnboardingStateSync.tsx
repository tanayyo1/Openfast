"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useOnboardingStore,
  type OnboardingStepId,
} from "@/stores/onboardingStore";

const stepToPage: Record<OnboardingStepId, string> = {
  project: "/onboarding/create-project",
  reddit: "/onboarding/connect-reddit",
  roadmap: "/onboarding/generate-roadmap",
};

type Props = {
  children: React.ReactNode;
};

export function OnboardingStateSync({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchProgress, completed, currentStep, isLoading, completedSteps } =
    useOnboardingStore();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    if (isLoading) return;

    if (completed) {
      if (pathname.startsWith("/onboarding")) {
        router.replace("/dashboard");
      }
      return;
    }

    const expectedPage = stepToPage[currentStep];
    if (
      expectedPage &&
      pathname !== expectedPage &&
      pathname.startsWith("/onboarding")
    ) {
      const isOnValidStep = completedSteps.some((step) => {
        const stepPage = stepToPage[step];
        return pathname.startsWith(stepPage);
      });

      if (!isOnValidStep) {
        router.replace(expectedPage);
      }
    }
  }, [isLoading, completed, currentStep, pathname, router, completedSteps]);

  return <>{children}</>;
}

export function useOnboardingState() {
  const store = useOnboardingStore();
  return store;
}
