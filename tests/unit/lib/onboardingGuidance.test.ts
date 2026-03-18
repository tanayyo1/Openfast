import { buildGuidedOnboardingItems } from "@/lib/onboardingGuidance";
import type { OnboardingStep } from "@/lib/onboardingProgress";

function makeStep(
  overrides: Partial<OnboardingStep> & Pick<OnboardingStep, "id">,
): OnboardingStep {
  const { id, ...rest } = overrides;
  return {
    id,
    title: "Step title",
    description: "Step description",
    href: "/onboarding",
    action: "Continue",
    status: "blocked",
    detail: "Step detail",
    ...rest,
  };
}

describe("onboarding guidance", () => {
  test("adds ETA and checkpoint metadata per step", () => {
    const items = buildGuidedOnboardingItems([
      makeStep({ id: "project", status: "current" }),
      makeStep({ id: "roadmap", status: "complete" }),
    ]);

    expect(items.map((item) => item.etaMinutes)).toEqual([2, 2]);
    expect(items[0]?.checkpoint).toBe(
      "Project context saved with goals and brand voice.",
    );
    expect(items[1]?.checkpoint).toBe(
      "First roadmap generated and ready for monitoring.",
    );
  });

  test("returns actionable hints by status and step", () => {
    const items = buildGuidedOnboardingItems([
      makeStep({ id: "project", status: "current" }),
      makeStep({ id: "roadmap", status: "blocked" }),
      makeStep({ id: "roadmap", status: "complete" }),
    ]);

    expect(items[0]?.hint).toContain("product basics");
    expect(items[1]?.hint).toContain("Create a project");
    expect(items[2]?.hint).toContain("Monitor");
  });
});
