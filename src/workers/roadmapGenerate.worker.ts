import type { Job } from "bullmq";
import type { RoadmapGenerateJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";

export async function processRoadmapGenerateJob(
  job: Job<RoadmapGenerateJobData>,
) {
  const { workspaceId, projectId, roadmapId } = job.data;
  if (!workspaceId || !projectId) throw new Error("INVALID_JOB_DATA");

  const roadmap = roadmapId
    ? await prisma.roadmap.findFirst({
        where: { id: roadmapId, workspaceId, projectId },
        select: { id: true },
      })
    : await prisma.roadmap.findFirst({
        where: { workspaceId, projectId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  if (!roadmap) throw new Error("ROADMAP_NOT_FOUND");

  const taskCount = await prisma.roadmapTask.count({
    where: { workspaceId, roadmapId: roadmap.id },
  });

  return {
    roadmapId: roadmap.id,
    taskCount,
    status: "ready" as const,
  };
}
