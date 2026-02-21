import { buildDashboardContinueAction } from "@/lib/dashboardContinueAction";

const base = {
  projectCount: 1,
  activeRedditAccountCount: 1,
  activeRoadmapCount: 1,
  pendingApprovalCount: 0,
  approvedUnscheduledCount: 0,
  editableDraftId: null,
  priorityTaskId: null,
  hasQueuedScheduledPosts: false,
  latestProjectId: "proj_1",
} as const;

describe("buildDashboardContinueAction", () => {
  test("routes to create project when workspace has none", () => {
    const action = buildDashboardContinueAction({
      ...base,
      projectCount: 0,
    });

    expect(action.href).toBe("/onboarding/create-project");
    expect(action.action).toBe("Create project");
  });

  test("routes to connect reddit when no active account exists", () => {
    const action = buildDashboardContinueAction({
      ...base,
      activeRedditAccountCount: 0,
      latestProjectId: "proj_99",
    });

    expect(action.href).toBe("/onboarding/connect-reddit?projectId=proj_99");
    expect(action.action).toBe("Connect account");
  });

  test("prioritizes approvals over other execution states", () => {
    const action = buildDashboardContinueAction({
      ...base,
      pendingApprovalCount: 2,
      approvedUnscheduledCount: 3,
      editableDraftId: "draft_1",
      priorityTaskId: "task_1",
    });

    expect(action.href).toBe("/approvals");
    expect(action.title).toContain("pending approvals");
  });

  test("routes to scheduling when approved drafts are ready", () => {
    const action = buildDashboardContinueAction({
      ...base,
      approvedUnscheduledCount: 1,
      editableDraftId: "draft_1",
    });

    expect(action.href).toBe("/scheduling/calendar");
    expect(action.action).toBe("Open scheduling");
  });

  test("routes to editable draft when no approvals or scheduling blockers", () => {
    const action = buildDashboardContinueAction({
      ...base,
      editableDraftId: "draft_123",
      priorityTaskId: "task_1",
    });

    expect(action.href).toBe("/content/drafts/draft_123");
    expect(action.action).toBe("Open draft");
  });

  test("routes to task when task exists and no draft needs edits", () => {
    const action = buildDashboardContinueAction({
      ...base,
      priorityTaskId: "task_123",
    });

    expect(action.href).toBe("/tasks/task_123");
    expect(action.action).toBe("Open task");
  });

  test("routes to roadmap generation when nothing else is active and no roadmap", () => {
    const action = buildDashboardContinueAction({
      ...base,
      activeRoadmapCount: 0,
    });

    expect(action.href).toBe("/roadmaps/generate?projectId=proj_1");
    expect(action.action).toBe("Generate roadmap");
  });

  test("prioritizes queue monitoring before roadmap generation", () => {
    const action = buildDashboardContinueAction({
      ...base,
      activeRoadmapCount: 0,
      hasQueuedScheduledPosts: true,
    });

    expect(action.href).toBe("/scheduling/queue");
    expect(action.action).toBe("Open queue");
  });

  test("falls back to analytics when execution queue is clear", () => {
    const action = buildDashboardContinueAction(base);

    expect(action.href).toBe("/analytics");
    expect(action.action).toBe("Open analytics");
  });
});
