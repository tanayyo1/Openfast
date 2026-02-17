import type { Job } from "bullmq";
import { SafetyTier } from "@prisma/client";
import type { RiskAccountHealthJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";

function deriveSafetyTier(input: {
  healthScore: number;
  removalRate: number;
  sampleSize: number;
  linkKarma: number;
  commentKarma: number;
}) {
  if (
    input.healthScore < 35 ||
    (input.sampleSize >= 5 && input.removalRate >= 0.3)
  ) {
    return SafetyTier.RESTRICTED;
  }

  const totalKarma =
    Math.max(0, input.linkKarma) + Math.max(0, input.commentKarma);
  if (totalKarma >= 1000 && input.healthScore >= 75) {
    return SafetyTier.TRUSTED;
  }
  if (totalKarma >= 100) {
    return SafetyTier.ESTABLISHED;
  }
  return SafetyTier.NEW;
}

export async function processRiskAccountHealthJob(
  job: Job<RiskAccountHealthJobData>,
) {
  const { workspaceId, redditAccountId } = job.data;
  if (!workspaceId || !redditAccountId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId, isActive: true },
    select: { id: true, linkKarma: true, commentKarma: true, safetyTier: true },
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
  const healthScorePercent = Number((healthScore * 100).toFixed(2));
  const nextSafetyTier = deriveSafetyTier({
    healthScore: healthScorePercent,
    removalRate,
    sampleSize: snapshots.length,
    linkKarma: account.linkKarma,
    commentKarma: account.commentKarma,
  });

  await prisma.$transaction([
    prisma.accountHealthSnapshot.create({
      data: {
        workspaceId,
        redditAccountId,
        healthScore: healthScorePercent,
        signalsJson: {
          sampleSize: snapshots.length,
          removals,
          removalRate: Number(removalRate.toFixed(4)),
          avgScore: Number(avgScore.toFixed(2)),
          avgComments: Number(avgComments.toFixed(2)),
        },
      },
    }),
    prisma.redditAccount.update({
      where: { id: redditAccountId },
      data: { safetyTier: nextSafetyTier },
    }),
  ]);

  return {
    workspaceId,
    redditAccountId,
    healthScore: healthScorePercent,
    sampleSize: snapshots.length,
    safetyTier: nextSafetyTier,
    previousSafetyTier: account.safetyTier,
    status: "captured" as const,
  };
}
