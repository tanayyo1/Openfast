type DashboardContinueActionInput = {
  projectCount: number;
  activeRedditAccountCount: number;
  activeRoadmapCount: number;
  pendingApprovalCount: number;
  approvedUnscheduledCount: number;
  editableDraftId: string | null;
  priorityTaskId: string | null;
  hasQueuedScheduledPosts: boolean;
  latestProjectId: string | null;
};

export type DashboardContinueAction = {
  title: string;
  detail: string;
  href: string;
  action: string;
};

function withProjectId(base: string, projectId: string | null) {
  if (!projectId) return base;
  return `${base}?projectId=${encodeURIComponent(projectId)}`;
}

function formatCount(value: number, singular: string, plural: string) {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

export function buildDashboardContinueAction(
  input: DashboardContinueActionInput,
): DashboardContinueAction {
  if (input.projectCount === 0) {
    return {
      title: "Create your first project",
      detail: "Projects unlock roadmap generation, drafts, and scheduling.",
      href: "/onboarding/create-project",
      action: "Create project",
    };
  }

  if (input.activeRedditAccountCount === 0) {
    return {
      title: "Connect a Reddit account",
      detail: "At least one active account is required to plan and publish.",
      href: withProjectId("/onboarding/connect-reddit", input.latestProjectId),
      action: "Connect account",
    };
  }

  if (input.pendingApprovalCount > 0) {
    return {
      title: "Review pending approvals",
      detail: `${formatCount(input.pendingApprovalCount, "draft", "drafts")} waiting for approval.`,
      href: "/approvals",
      action: "Open approvals",
    };
  }

  if (input.approvedUnscheduledCount > 0) {
    return {
      title: "Schedule approved drafts",
      detail: `${formatCount(input.approvedUnscheduledCount, "approved draft", "approved drafts")} ready to schedule.`,
      href: "/scheduling/calendar",
      action: "Open scheduling",
    };
  }

  if (input.editableDraftId) {
    return {
      title: "Continue editing your latest draft",
      detail: "Finalize content quality, then request approval.",
      href: `/content/drafts/${encodeURIComponent(input.editableDraftId)}`,
      action: "Open draft",
    };
  }

  if (input.priorityTaskId) {
    return {
      title: "Continue your highest-priority task",
      detail: "Complete task execution to keep roadmap momentum.",
      href: `/tasks/${encodeURIComponent(input.priorityTaskId)}`,
      action: "Open task",
    };
  }

  if (input.hasQueuedScheduledPosts) {
    return {
      title: "Monitor upcoming queue jobs",
      detail:
        "You have scheduled items in flight. Check queue status and timing.",
      href: "/scheduling/queue",
      action: "Open queue",
    };
  }

  if (input.activeRoadmapCount === 0) {
    return {
      title: "Generate your next roadmap",
      detail:
        "No active roadmap found. Generate one to keep the pipeline full.",
      href: withProjectId("/roadmaps/generate", input.latestProjectId),
      action: "Generate roadmap",
    };
  }

  return {
    title: "Review analytics and iterate",
    detail:
      "Execution queue is clear. Use performance data to plan next cycle.",
    href: "/analytics",
    action: "Open analytics",
  };
}
