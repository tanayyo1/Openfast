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
    expect(progress.nextAction.action).toBe("Refresh page");
    expect(progress.nextAction.kind).toBe("refresh");
    expect(progress.steps.every((step) => step.status === "blocked")).toBe(
      true,
    );
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
    expect(progress.steps[2].status).toBe("blocked");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe("/onboarding/create-project");
  });

  test("marks reddit step current when projects exist but no accounts", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 1,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 0,
      latestProjectId: "proj_1",
    });

    expect(progress.steps[0].status).toBe("complete");
    expect(progress.steps[1].status).toBe("current");
    expect(progress.steps[2].status).toBe("blocked");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe(
      "/onboarding/connect-reddit?projectId=proj_1",
    );
  });

  test("marks roadmap step current when project and account are ready", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 2,
      activeRedditAccountCount: 1,
      activeRoadmapCount: 0,
      latestProjectId: "proj_99",
    });

    expect(progress.steps[0].status).toBe("complete");
    expect(progress.steps[1].status).toBe("complete");
    expect(progress.steps[2].status).toBe("current");
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe(
      "/roadmaps/generate?projectId=proj_99",
    );
  });

  test("marks onboarding complete when all steps are done", () => {
    const progress = buildOnboardingProgress({
      hasWorkspace: true,
      projectCount: 3,
      activeRedditAccountCount: 2,
      activeRoadmapCount: 2,
      latestProjectId: "proj_done",
    });

    expect(progress.completedCount).toBe(3);
    expect(progress.steps.every((step) => step.status === "complete")).toBe(
      true,
    );
    expect(progress.nextAction.kind).toBe("link");
    expect(progress.nextAction.href).toBe("/dashboard");
    expect(progress.nextAction.action).toBe("Open dashboard");
  });
});
