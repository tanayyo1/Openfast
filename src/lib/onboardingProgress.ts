export type OnboardingStepStatus = "complete" | "current" | "blocked";

export type OnboardingStep = {
  id: "project" | "roadmap";
  title: string;
  description: string;
  href: string;
  action: string;
  status: OnboardingStepStatus;
  detail: string;
};

export type OnboardingProgressInput = {
  hasWorkspace: boolean;
  projectCount: number;
  activeRedditAccountCount: number;
  activeRoadmapCount: number;
  latestProjectId: string | null;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  nextAction: {
    kind: "link" | "refresh";
    title: string;
    href: string;
    action: string;
  };
};

function formatCount(value: number, singular: string, plural: string) {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

function buildRoadmapHref(projectId: string | null) {
  if (!projectId) return "/onboarding/generate-roadmap";
  return `/onboarding/generate-roadmap?projectId=${encodeURIComponent(projectId)}`;
}

export function buildOnboardingProgress(
  input: OnboardingProgressInput,
): OnboardingProgress {
  const totalCount = 2;

  if (!input.hasWorkspace) {
    const steps: OnboardingStep[] = [
      {
        id: "project",
        title: "Create your first project",
        description: "Define your product, goals, and target audience.",
        href: "/onboarding/create-project",
        action: "Create project",
        status: "blocked",
        detail: "Workspace setup is still syncing. Refresh and try again.",
      },
      {
        id: "roadmap",
        title: "Generate your roadmap",
        description: "Create a posting plan with subreddit targets and timing.",
        href: "/onboarding/generate-roadmap",
        action: "Generate roadmap",
        status: "blocked",
        detail: "Complete workspace setup first.",
      },
    ];

    return {
      steps,
      completedCount: 0,
      totalCount,
      nextAction: {
        kind: "refresh",
        title: "Workspace setup pending",
        href: "/onboarding",
        action: "Refresh page",
      },
    };
  }

  const projectDone = input.projectCount > 0;
  const roadmapDone = input.activeRoadmapCount > 0;

  const steps: OnboardingStep[] = [
    {
      id: "project",
      title: "Create your first project",
      description: "Define your product, goals, and target audience.",
      href: "/onboarding/create-project",
      action: projectDone ? "Add another project" : "Create project",
      status: projectDone ? "complete" : "current",
      detail: projectDone
        ? `${formatCount(input.projectCount, "project", "projects")} ready.`
        : "Create at least one project to continue.",
    },
    {
      id: "roadmap",
      title: "Generate your roadmap",
      description:
        "Turn your project into a posting plan with subreddit targets and timing windows.",
      href: roadmapDone ? "/roadmaps" : buildRoadmapHref(input.latestProjectId),
      action: roadmapDone ? "View roadmaps" : "Generate roadmap",
      status: roadmapDone ? "complete" : projectDone ? "current" : "blocked",
      detail: roadmapDone
        ? `${formatCount(input.activeRoadmapCount, "active roadmap", "active roadmaps")} generated.`
        : projectDone
          ? "Generate your first posting roadmap."
          : "Create a project first.",
    },
  ];

  const completedCount = steps.filter(
    (step) => step.status === "complete",
  ).length;
  const firstPending = steps.find((step) => step.status !== "complete");

  if (!firstPending) {
    return {
      steps,
      completedCount,
      totalCount,
      nextAction: {
        kind: "link",
        title: "Onboarding complete",
        href: "/dashboard",
        action: "Open dashboard",
      },
    };
  }

  return {
    steps,
    completedCount,
    totalCount,
    nextAction: {
      kind: "link",
      title: `Next: ${firstPending.title}`,
      href: firstPending.href,
      action: firstPending.action,
    },
  };
}
