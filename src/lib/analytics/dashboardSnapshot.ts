import { prisma } from "@/lib/prisma";

export type WorkspaceDashboardSummary = {
  projectCount: number;
  publishedCount: number;
  removedCount: number;
  totalScore: number;
  avgScore: number;
  totalComments: number;
  avgComments: number;
  scheduledCount: number;
  publishingCount: number;
  failedCount: number;
  cancelledCount: number;
};

export type WorkspaceDashboardProjectMetrics = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  publishedCount: number;
  removedCount: number;
  totalScore: number;
  totalComments: number;
  scheduledCount: number;
  failedCount: number;
  avgScore: number;
  avgComments: number;
};

export type WorkspaceDashboardSnapshot = {
  summary: WorkspaceDashboardSummary;
  byProject: WorkspaceDashboardProjectMetrics[];
};

export async function computeWorkspaceDashboardSnapshot(
  workspaceId: string,
): Promise<WorkspaceDashboardSnapshot> {
  const [projects, scheduledPosts, publishedItems] = await Promise.all([
    prisma.project.findMany({
      where: {
        workspaceId,
        status: { not: "ARCHIVED" },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, status: true },
    }),
    prisma.scheduledPost.findMany({
      where: { workspaceId },
      select: {
        status: true,
        draft: { select: { projectId: true } },
      },
    }),
    prisma.publishedItem.findMany({
      where: {
        workspaceId,
        scheduledPost: { isNot: null },
      },
      select: {
        id: true,
        scheduledPost: { select: { draft: { select: { projectId: true } } } },
        snapshots: {
          orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { score: true, numComments: true, isRemoved: true },
        },
      },
    }),
  ]);

  const statusTotals = scheduledPosts.reduce<Record<string, number>>(
    (acc, post) => {
      acc[post.status] = (acc[post.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const projectMetrics = new Map<
    string,
    {
      publishedCount: number;
      removedCount: number;
      totalScore: number;
      totalComments: number;
      scheduledCount: number;
      failedCount: number;
    }
  >();
  for (const project of projects) {
    projectMetrics.set(project.id, {
      publishedCount: 0,
      removedCount: 0,
      totalScore: 0,
      totalComments: 0,
      scheduledCount: 0,
      failedCount: 0,
    });
  }

  for (const post of scheduledPosts) {
    const projectId = post.draft.projectId;
    const metrics = projectMetrics.get(projectId);
    if (!metrics) continue;
    if (post.status === "SCHEDULED") metrics.scheduledCount += 1;
    if (
      post.status === "FAILED_RETRYABLE" ||
      post.status === "FAILED_PERMANENT"
    ) {
      metrics.failedCount += 1;
    }
  }

  let publishedCount = 0;
  let removedCount = 0;
  let totalScore = 0;
  let totalComments = 0;

  for (const item of publishedItems) {
    const projectId = item.scheduledPost?.draft.projectId;
    if (!projectId) continue;
    const metrics = projectMetrics.get(projectId);
    if (!metrics) continue;
    metrics.publishedCount += 1;
    publishedCount += 1;
    const latest = item.snapshots[0] ?? null;
    if (!latest) continue;
    metrics.totalScore += latest.score;
    metrics.totalComments += latest.numComments;
    totalScore += latest.score;
    totalComments += latest.numComments;
    if (latest.isRemoved) {
      metrics.removedCount += 1;
      removedCount += 1;
    }
  }

  const byProject: WorkspaceDashboardProjectMetrics[] = projects.map((project) => {
    const metrics = projectMetrics.get(project.id);
    const safe = metrics ?? {
      publishedCount: 0,
      removedCount: 0,
      totalScore: 0,
      totalComments: 0,
      scheduledCount: 0,
      failedCount: 0,
    };
    return {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      ...safe,
      avgScore: safe.publishedCount ? safe.totalScore / safe.publishedCount : 0,
      avgComments: safe.publishedCount ? safe.totalComments / safe.publishedCount : 0,
    };
  });

  return {
    summary: {
      projectCount: projects.length,
      publishedCount,
      removedCount,
      totalScore,
      avgScore: publishedCount ? totalScore / publishedCount : 0,
      totalComments,
      avgComments: publishedCount ? totalComments / publishedCount : 0,
      scheduledCount: statusTotals.SCHEDULED ?? 0,
      publishingCount: statusTotals.PUBLISHING ?? 0,
      failedCount:
        (statusTotals.FAILED_RETRYABLE ?? 0) +
        (statusTotals.FAILED_PERMANENT ?? 0),
      cancelledCount: statusTotals.CANCELLED ?? 0,
    },
    byProject,
  };
}
