import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitsForPlan } from "@/lib/billing/plans";

export async function applyWorkspacePlan(
  workspaceId: string,
  plan: Plan,
): Promise<void> {
  const limits = limitsForPlan(plan);
  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    }),
    prisma.workspaceEntitlement.upsert({
      where: { workspaceId },
      update: {
        maxProjects: limits.maxProjects,
        maxRedditAccounts: limits.maxRedditAccounts,
        maxScheduledPosts: limits.maxScheduledPosts,
        maxDraftsPerMonth: limits.maxDraftsPerMonth,
        roadmapDays: limits.roadmapDays,
        hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
        hasSmartFinder: limits.hasSmartFinder,
        hasTeamFeatures: limits.hasTeamFeatures,
      },
      create: {
        workspaceId,
        maxProjects: limits.maxProjects,
        maxRedditAccounts: limits.maxRedditAccounts,
        maxScheduledPosts: limits.maxScheduledPosts,
        maxDraftsPerMonth: limits.maxDraftsPerMonth,
        roadmapDays: limits.roadmapDays,
        hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
        hasSmartFinder: limits.hasSmartFinder,
        hasTeamFeatures: limits.hasTeamFeatures,
      },
    }),
  ]);
}
