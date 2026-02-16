import type { Plan } from "@prisma/client";

export type PlanLimits = {
  plan: Plan;
  maxProjects: number;
  maxRedditAccounts: number;
  maxScheduledPosts: number;
  maxDraftsPerMonth: number;
  roadmapDays: number;
  hasAdvancedAnalytics: boolean;
  hasSmartFinder: boolean;
  hasTeamFeatures: boolean;
};

export function limitsForPlan(plan: Plan): PlanLimits {
  if (plan === "PRO") {
    return {
      plan,
      maxProjects: 5,
      maxRedditAccounts: 3,
      maxScheduledPosts: 200,
      maxDraftsPerMonth: 2000,
      roadmapDays: 30,
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
      hasTeamFeatures: false,
    };
  }

  if (plan === "LIFETIME") {
    return {
      plan,
      maxProjects: 9999,
      maxRedditAccounts: 9999,
      maxScheduledPosts: 99999,
      maxDraftsPerMonth: 99999,
      roadmapDays: 30,
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
      hasTeamFeatures: true,
    };
  }

  if (plan === "ENTERPRISE") {
    return {
      plan,
      maxProjects: 99999,
      maxRedditAccounts: 99999,
      maxScheduledPosts: 999999,
      maxDraftsPerMonth: 999999,
      roadmapDays: 60,
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
      hasTeamFeatures: true,
    };
  }

  return {
    plan: "FREE",
    maxProjects: 1,
    maxRedditAccounts: 1,
    maxScheduledPosts: 10,
    maxDraftsPerMonth: 10,
    roadmapDays: 7,
    hasAdvancedAnalytics: false,
    hasSmartFinder: false,
    hasTeamFeatures: false,
  };
}
