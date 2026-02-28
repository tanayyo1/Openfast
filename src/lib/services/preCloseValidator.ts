import { prisma } from "@/lib/prisma";

export type ChecklistItem = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning";
  message?: string;
  details?: string;
};

export type PreCloseValidationResult = {
  valid: boolean;
  checklist: ChecklistItem[];
  warnings: string[];
  errors: string[];
};

export type ProjectChecklistConfig = {
  checkTasksComplete: boolean;
  checkRoadmapsComplete: boolean;
  checkNoBlockedTasks: boolean;
  allowSkippedTasks: boolean;
};

const DEFAULT_CONFIG: ProjectChecklistConfig = {
  checkTasksComplete: true,
  checkRoadmapsComplete: true,
  checkNoBlockedTasks: true,
  allowSkippedTasks: true,
};

export async function validateProjectClosure(
  projectId: string,
  config: ProjectChecklistConfig = DEFAULT_CONFIG,
): Promise<PreCloseValidationResult> {
  const checklist: ChecklistItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      roadmaps: {
        include: {
          tasks: true,
        },
      },
    },
  });

  if (!project) {
    return {
      valid: false,
      checklist: [],
      warnings: [],
      errors: ["Project not found"],
    };
  }

  if (config.checkRoadmapsComplete) {
    const roadmaps = project.roadmaps;
    const completedRoadmaps = roadmaps.filter((r) => r.status === "COMPLETED");
    const totalRoadmaps = roadmaps.length;

    const roadmapItem: ChecklistItem = {
      id: "roadmaps-complete",
      label: "All roadmaps completed",
      status:
        totalRoadmaps === 0
          ? "warning"
          : completedRoadmaps.length === totalRoadmaps
            ? "pass"
            : "fail",
      message:
        totalRoadmaps === 0
          ? "No roadmaps found"
          : `${completedRoadmaps.length}/${totalRoadmaps} roadmaps completed`,
      details:
        totalRoadmaps > 0
          ? `Completed: ${completedRoadmaps.length}, Total: ${totalRoadmaps}`
          : undefined,
    };
    checklist.push(roadmapItem);

    if (roadmapItem.status === "fail") {
      errors.push("Not all roadmaps are completed");
    }
  }

  if (config.checkTasksComplete) {
    const allTasks = project.roadmaps.flatMap((r) => r.tasks);
    const totalTasks = allTasks.length;

    if (totalTasks === 0) {
      checklist.push({
        id: "tasks-complete",
        label: "All tasks completed",
        status: "warning",
        message: "No tasks found",
      });
      warnings.push("Project has no tasks");
    } else {
      const completedTasks = allTasks.filter(
        (t) => t.status === "COMPLETED",
      ).length;
      const skippedTasks = allTasks.filter(
        (t) => t.status === "SKIPPED",
      ).length;
      const pendingTasks = allTasks.filter(
        (t) => t.status === "PENDING",
      ).length;
      const inProgressTasks = allTasks.filter(
        (t) => t.status === "IN_PROGRESS",
      ).length;

      const validNonPending =
        completedTasks + (config.allowSkippedTasks ? skippedTasks : 0);
      const allResolved = pendingTasks === 0 && inProgressTasks === 0;

      const taskItem: ChecklistItem = {
        id: "tasks-complete",
        label: "All tasks completed",
        status: allResolved ? "pass" : "fail",
        message: `${completedTasks} completed, ${skippedTasks} skipped, ${pendingTasks} pending, ${inProgressTasks} in progress`,
        details: `Total: ${totalTasks}, Resolved: ${validNonPending}`,
      };
      checklist.push(taskItem);

      if (!allResolved) {
        errors.push("Not all tasks are completed");
      }
    }
  }

  if (config.checkNoBlockedTasks) {
    const allTasks = project.roadmaps.flatMap((r) => r.tasks);
    const blockedTasks = allTasks.filter((t) => t.status === "BLOCKED");

    const blockedItem: ChecklistItem = {
      id: "no-blocked-tasks",
      label: "No blocked tasks",
      status: blockedTasks.length === 0 ? "pass" : "fail",
      message:
        blockedTasks.length === 0
          ? "No blocked tasks"
          : `${blockedTasks.length} blocked task(s)`,
      details:
        blockedTasks.length > 0
          ? blockedTasks.map((t) => t.instructions.slice(0, 50)).join(", ")
          : undefined,
    };
    checklist.push(blockedItem);

    if (blockedTasks.length > 0) {
      errors.push(`${blockedTasks.length} task(s) are blocked`);
    }
  }

  const hasDescription = project.description && project.description.length > 0;
  checklist.push({
    id: "project-description",
    label: "Project has description",
    status: hasDescription ? "pass" : "warning",
    message: hasDescription ? "Description provided" : "No description",
  });

  const hasNiche = project.niche && project.niche.length > 0;
  checklist.push({
    id: "project-niche",
    label: "Project niche defined",
    status: hasNiche ? "pass" : "warning",
    message: hasNiche ? "Niche defined" : "No niche set",
  });

  const valid = errors.length === 0;

  return {
    valid,
    checklist,
    warnings,
    errors,
  };
}

export async function getProjectCompletionStats(projectId: string): Promise<{
  totalRoadmaps: number;
  completedRoadmaps: number;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  completionPercentage: number;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      roadmaps: {
        include: {
          tasks: true,
        },
      },
    },
  });

  if (!project) {
    return {
      totalRoadmaps: 0,
      completedRoadmaps: 0,
      totalTasks: 0,
      completedTasks: 0,
      skippedTasks: 0,
      pendingTasks: 0,
      blockedTasks: 0,
      inProgressTasks: 0,
      completionPercentage: 0,
    };
  }

  const allTasks = project.roadmaps.flatMap((r) => r.tasks);
  const totalRoadmaps = project.roadmaps.length;
  const completedRoadmaps = project.roadmaps.filter(
    (r) => r.status === "COMPLETED",
  ).length;
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(
    (t) => t.status === "COMPLETED",
  ).length;
  const skippedTasks = allTasks.filter((t) => t.status === "SKIPPED").length;
  const pendingTasks = allTasks.filter((t) => t.status === "PENDING").length;
  const blockedTasks = allTasks.filter((t) => t.status === "BLOCKED").length;
  const inProgressTasks = allTasks.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;

  const resolvedTasks = completedTasks + skippedTasks;
  const completionPercentage =
    totalTasks > 0 ? Math.round((resolvedTasks / totalTasks) * 100) : 0;

  return {
    totalRoadmaps,
    completedRoadmaps,
    totalTasks,
    completedTasks,
    skippedTasks,
    pendingTasks,
    blockedTasks,
    inProgressTasks,
    completionPercentage,
  };
}
