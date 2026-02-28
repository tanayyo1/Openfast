import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type RetargetResult = {
  success: boolean;
  roadmapId: string;
  oldStartDate: Date;
  newStartDate: Date;
  deltaDays: number;
  tasksUpdated: number;
  errors: string[];
};

export type RetargetOptions = {
  retargetCompletedTasks?: boolean;
  retargetLockedTasks?: boolean;
};

const DEFAULT_OPTIONS: RetargetOptions = {
  retargetCompletedTasks: false,
  retargetLockedTasks: false,
};

export async function retargetRoadmapTasks(
  roadmapId: string,
  workspaceId: string,
  newStartDate: Date,
  options: RetargetOptions = DEFAULT_OPTIONS,
): Promise<RetargetResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, workspaceId },
    select: { id: true, startDate: true, horizonDays: true },
  });

  if (!roadmap) {
    return {
      success: false,
      roadmapId,
      oldStartDate: new Date(),
      newStartDate,
      deltaDays: 0,
      tasksUpdated: 0,
      errors: ["Roadmap not found or access denied"],
    };
  }

  const oldStartDate = roadmap.startDate;
  const deltaMs = newStartDate.getTime() - oldStartDate.getTime();
  const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));

  if (deltaDays === 0) {
    return {
      success: true,
      roadmapId,
      oldStartDate,
      newStartDate,
      deltaDays: 0,
      tasksUpdated: 0,
      errors: [],
    };
  }

  const taskWhere: Prisma.RoadmapTaskWhereInput = {
    roadmapId,
  };

  if (!opts.retargetCompletedTasks) {
    taskWhere.status = { not: "COMPLETED" };
  }

  if (!opts.retargetLockedTasks) {
    taskWhere.status = {
      ...(taskWhere.status as Prisma.EnumTaskStatusFilter | undefined),
      notIn: ["BLOCKED", "SKIPPED"],
    };
  }

  const tasksToUpdate = await prisma.roadmapTask.findMany({
    where: taskWhere,
    select: { id: true },
  });

  if (tasksToUpdate.length === 0) {
    await prisma.roadmap.update({
      where: { id: roadmapId },
      data: { startDate: newStartDate },
    });

    return {
      success: true,
      roadmapId,
      oldStartDate,
      newStartDate,
      deltaDays,
      tasksUpdated: 0,
      errors: [],
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.roadmap.update({
        where: { id: roadmapId },
        data: { startDate: newStartDate },
      });

      const updateResult = await tx.roadmapTask.updateMany({
        where: { id: { in: tasksToUpdate.map((t) => t.id) } },
        data: {},
      });

      return { count: updateResult.count };
    });

    return {
      success: true,
      roadmapId,
      oldStartDate,
      newStartDate,
      deltaDays,
      tasksUpdated: result.count,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      roadmapId,
      oldStartDate,
      newStartDate,
      deltaDays,
      tasksUpdated: 0,
      errors: [error instanceof Error ? error.message : "Transaction failed"],
    };
  }
}

export function calculateDayIndexFromDate(
  taskDate: Date,
  roadmapStartDate: Date,
  horizonDays: number,
): number {
  const diffMs = taskDate.getTime() - roadmapStartDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(horizonDays, diffDays + 1));
}

export function calculateActualDueDate(
  dayIndex: number,
  startDate: Date,
): Date {
  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + (dayIndex - 1));
  return dueDate;
}
