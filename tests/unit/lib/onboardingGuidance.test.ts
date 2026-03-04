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
      makeStep({ id: "reddit", status: "blocked" }),
      makeStep({ id: "roadmap", status: "complete" }),
    ]);

    expect(items.map((item) => item.etaMinutes)).toEqual([2, 3, 2]);
    expect(items[0]?.checkpoint).toBe(
      "Project context saved with goals and brand voice.",
    );
    expect(items[1]?.checkpoint).toBe(
      "At least one active Reddit account is connected.",
    );
    expect(items[2]?.checkpoint).toBe(
      "First roadmap generated and ready for execution.",
    );
  });

  test("returns actionable hints by status and step", () => {
    const items = buildGuidedOnboardingItems([
      makeStep({ id: "project", status: "current" }),
      makeStep({ id: "reddit", status: "current" }),
      makeStep({ id: "roadmap", status: "blocked" }),
      makeStep({ id: "roadmap", status: "complete" }),
    ]);

    expect(items[0]?.hint).toContain("product basics");
    expect(items[1]?.hint).toContain("Connect one account");
    expect(items[2]?.hint).toContain("Complete project + account steps");
    expect(items[3]?.hint).toContain("Move to execution");
  });
});
