import { buildOnboardingProgress } from "@/lib/onboardingProgress";

describe("buildOnboardingProgress", () => {
  test("returns blocked flow when workspace is missing", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: false,
      projectCount: 0,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 0,
      latestProjectId: null,
    });

    expect(progress.completedCount).toBe(0);
    expect(progress.totalCount).toBe(2);
    expect(progress.nextAction.action).toBe("Refresh page");
    expect(progress.nextAction.kind).toBe("refresh");
    expect(progress.steps.every((step) => step.status === "blocked")).toBe(
      true,
    );
    expect(progress.steps[1].href).toBe("/onboarding/generate-roadmap");
  });

  test("marks project step current when no projects exist", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 0,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 0,
      latestProjectId: null,
    });

    expect(progress.steps[0].status).toBe("current");
    expect(progress.steps[1].status).toBe("blocked");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe("/onboarding/create-project");
  });

  test("marks roadmap step current when project exists", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 1,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 0,
      latestProjectId: "proj_1",
    });

    expect(progress.steps[0].status).toBe("complete");
    expect(progress.steps[1].status).toBe("current");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe(
      "/onboarding/generate-roadmap?projectId=proj_1",
    );
  });

  test("marks onboarding complete when all steps are done", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 3,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 2,
      latestProjectId: "proj_done",
    });

    expect(progress.completedCount).toBe(2);
    expect(progress.steps.every((step) => step.status === "complete")).toBe(
      true,
    );
    expect(progress.steps[1].href).toBe("/roadmaps");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe("/dashboard");
    expect(progress.nextAction.action).toBe("Open dashboard");
  });
});
