import { prisma } from "@/lib/prisma";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

export type RoadmapListItem = {
  id: string;
  projectId: string;
  projectName: string;
  version: number;
  startDate: Date;
  horizonDays: number;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
};

export function roadmapWindowLabel(startDate: Date, horizonDays: number) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.max(0, horizonDays - 1));
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}

export async function loadRoadmapsPageData() {
  const session = await requireWorkspaceSessionForPage();
  const items = await prisma.roadmap.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    projectName: item.project.name,
    version: item.version,
    startDate: item.startDate,
    horizonDays: item.horizonDays,
    status: item.status,
  })) as RoadmapListItem[];
}

export async function loadRoadmapDetailPageData(roadmapId: string) {
  const session = await requireWorkspaceSessionForPage();
  const workspaceId = session.workspaceId;

  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, workspaceId },
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      project: { select: { name: true } },
    },
  });

  if (!roadmap) {
    return null;
  }

  const [tasks, pendingApprovals, scheduledCount, failureCount] =
    await Promise.all([
      prisma.roadmapTask.findMany({
        where: { roadmapId, workspaceId },
        orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          dayIndex: true,
          type: true,
          status: true,
          instructions: true,
          estimatedTime: true,
          subreddit: { select: { name: true } },
        },
      }),
      prisma.draft.count({
        where: {
          workspaceId,
          task: { roadmapId },
          status: "REVIEWING",
        },
      }),
      prisma.scheduledPost.count({
        where: {
          workspaceId,
          draft: { task: { roadmapId } },
          status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHING"] },
        },
      }),
      prisma.scheduledPost.count({
        where: {
          workspaceId,
          draft: { task: { roadmapId } },
          status: { in: ["FAILED_RETRYABLE", "FAILED_PERMANENT"] },
        },
      }),
    ]);

  return {
    roadmap,
    tasks,
    pendingApprovals,
    scheduledCount,
    failureCount,
  };
}

export async function loadRoadmapGeneratePageData() {
  const session = await requireWorkspaceSessionForPage();
  const workspaceId = session.workspaceId;

  const [projects, accounts] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.redditAccount.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, redditUsername: true, safetyTier: true },
    }),
  ]);

  return { projects, accounts };
}

export function resolveInitialRoadmapProjectId(
  projects: Array<{ id: string }>,
  projectParam: string | string[] | undefined,
) {
  const requestedId =
    typeof projectParam === "string"
      ? projectParam
      : Array.isArray(projectParam)
        ? (projectParam[0] ?? "")
        : "";

  return projects.some((project) => project.id === requestedId)
    ? requestedId
    : (projects[0]?.id ?? "");
}
