export type OnboardingStepStatus = "complete" | "current" | "blocked";

export type OnboardingStep = {
  id: "project" | "reddit" | "roadmap";
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

function buildConnectHref(projectId: string | null) {
  if (!projectId) return "/onboarding/connect-reddit";
  return `/onboarding/connect-reddit?projectId=${encodeURIComponent(projectId)}`;
}

export function buildOnboardingProgress(
  input: OnboardingProgressInput,
): OnboardingProgress {
  const totalCount = 3;

  if (!input.hasWorkspace) {
    const steps: OnboardingStep[] = [
      {
        id: "project",
        title: "Create your first project",
        description: "Define your product, goals, and initial constraints.",
        href: "/onboarding/create-project",
        action: "Create project",
        status: "blocked",
        detail: "Workspace setup is still syncing. Refresh and try again.",
      },
      {
        id: "reddit",
        title: "Connect Reddit account",
        description:
          "Secure OAuth connection with rate limits and token encryption.",
        href: "/onboarding/connect-reddit",
        action: "Connect account",
        status: "blocked",
        detail: "Workspace setup must finish before account linking.",
      },
      {
        id: "roadmap",
        title: "Generate your roadmap",
        description:
          "Create an initial plan once project and Reddit account are ready.",
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
  const redditDone = input.activeRedditAccountCount > 0;
  const roadmapDone = input.activeRoadmapCount > 0;

  const steps: OnboardingStep[] = [
    {
      id: "project",
      title: "Create your first project",
      description: "Define your product, goals, and initial constraints.",
      href: "/onboarding/create-project",
      action: projectDone ? "Add another project" : "Create project",
      status: projectDone ? "complete" : "current",
      detail: projectDone
        ? `${formatCount(input.projectCount, "project", "projects")} ready.`
        : "Create at least one project to continue.",
    },
    {
      id: "reddit",
      title: "Connect Reddit account",
      description:
        "Secure OAuth connection with rate limits and token encryption.",
      href: buildConnectHref(input.latestProjectId),
      action: redditDone ? "Manage accounts" : "Connect account",
      status: redditDone ? "complete" : projectDone ? "current" : "blocked",
      detail: redditDone
        ? `${formatCount(input.activeRedditAccountCount, "account", "accounts")} connected.`
        : projectDone
          ? "Connect at least one active Reddit account."
          : "Create a project first.",
    },
    {
      id: "roadmap",
      title: "Generate your roadmap",
      description:
        "Turn your project and account setup into an executable posting plan.",
      href: roadmapDone ? "/roadmaps" : buildRoadmapHref(input.latestProjectId),
      action: roadmapDone ? "View roadmaps" : "Generate roadmap",
      status: roadmapDone
        ? "complete"
        : projectDone && redditDone
          ? "current"
          : "blocked",
      detail: roadmapDone
        ? `${formatCount(input.activeRoadmapCount, "active roadmap", "active roadmaps")} generated.`
        : projectDone && redditDone
          ? "Generate your first active roadmap."
          : "Requires a project and a connected Reddit account.",
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
