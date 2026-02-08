import type { Job } from "bullmq";
import type { RiskAccountHealthJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";

export async function processRiskAccountHealthJob(
  job: Job<RiskAccountHealthJobData>,
) {
  const { workspaceId, redditAccountId } = job.data;
  if (!workspaceId || !redditAccountId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId, isActive: true },
    select: { id: true },
  });
  if (!account) throw new Error("REDDIT_ACCOUNT_NOT_FOUND");

  const snapshots = await prisma.performanceSnapshot.findMany({
    where: {
      publishedItem: { workspaceId, redditAccountId },
    },
    orderBy: { capturedAt: "desc" },
    take: 30,
    select: {
      isRemoved: true,
      score: true,
      numComments: true,
      capturedAt: true,
    },
  });

  const total = Math.max(1, snapshots.length);
  const removals = snapshots.filter((s) => s.isRemoved).length;
  const avgScore =
    snapshots.reduce((sum, s) => sum + s.score, 0) /
    Math.max(1, snapshots.length);
  const avgComments =
    snapshots.reduce((sum, s) => sum + s.numComments, 0) /
    Math.max(1, snapshots.length);

  const removalRate = removals / total;
  let healthScore = 1 - removalRate * 0.7;
  if (avgScore > 5) healthScore += 0.1;
  if (avgComments > 2) healthScore += 0.1;
  healthScore = Math.max(0, Math.min(1, healthScore));

  await prisma.accountHealthSnapshot.create({
    data: {
      workspaceId,
      redditAccountId,
      healthScore: Number((healthScore * 100).toFixed(2)),
      signalsJson: {
        sampleSize: snapshots.length,
        removals,
        removalRate: Number(removalRate.toFixed(4)),
        avgScore: Number(avgScore.toFixed(2)),
        avgComments: Number(avgComments.toFixed(2)),
      },
    },
  });

  return {
    workspaceId,
    redditAccountId,
    healthScore: Number((healthScore * 100).toFixed(2)),
    sampleSize: snapshots.length,
    status: "captured" as const,
  };
}
