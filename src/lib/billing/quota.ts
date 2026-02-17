import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type QuotaResource =
  | "projects"
  | "reddit_accounts"
  | "scheduled_posts"
  | "ai_generations";

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED";
  readonly resource: QuotaResource;
  readonly limit: number;
  readonly used: number;

  constructor(opts: {
    resource: QuotaResource;
    limit: number;
    used: number;
    message: string;
  }) {
    super(opts.message);
    this.resource = opts.resource;
    this.limit = opts.limit;
    this.used = opts.used;
  }
}

export type WorkspaceEntitlements = {
  maxProjects: number;
  maxRedditAccounts: number;
  maxScheduledPosts: number;
  maxDraftsPerMonth: number;
  roadmapDays: number;
  hasAdvancedAnalytics: boolean;
  hasSmartFinder: boolean;
  hasTeamFeatures: boolean;
};

const DEFAULT_ENTITLEMENTS: WorkspaceEntitlements = {
  maxProjects: 1,
  maxRedditAccounts: 1,
  maxScheduledPosts: 10,
  maxDraftsPerMonth: 10,
  roadmapDays: 7,
  hasAdvancedAnalytics: false,
  hasSmartFinder: false,
  hasTeamFeatures: false,
};

export async function getWorkspaceEntitlements(
  workspaceId: string,
): Promise<WorkspaceEntitlements> {
  const ent = await prisma.workspaceEntitlement.findUnique({
    where: { workspaceId },
    select: {
      maxProjects: true,
      maxRedditAccounts: true,
      maxScheduledPosts: true,
      maxDraftsPerMonth: true,
      roadmapDays: true,
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
      hasTeamFeatures: true,
    },
  });
  return ent ?? DEFAULT_ENTITLEMENTS;
}

export async function assertWorkspaceQuota(opts: {
  workspaceId: string;
  resource: QuotaResource;
}) {
  const ent = await getWorkspaceEntitlements(opts.workspaceId);

  if (opts.resource === "projects") {
    const used = await prisma.project.count({
      where: { workspaceId: opts.workspaceId, status: { not: "ARCHIVED" } },
    });
    if (used >= ent.maxProjects) {
      throw new QuotaExceededError({
        resource: opts.resource,
        used,
        limit: ent.maxProjects,
        message: "Project quota reached",
      });
    }
    return { used, limit: ent.maxProjects };
  }

  if (opts.resource === "reddit_accounts") {
    const used = await prisma.redditAccount.count({
      where: { workspaceId: opts.workspaceId, isActive: true },
    });
    if (used >= ent.maxRedditAccounts) {
      throw new QuotaExceededError({
        resource: opts.resource,
        used,
        limit: ent.maxRedditAccounts,
        message: "Reddit account quota reached",
      });
    }
    return { used, limit: ent.maxRedditAccounts };
  }

  if (opts.resource === "scheduled_posts") {
    const used = await prisma.scheduledPost.count({
      where: {
        workspaceId: opts.workspaceId,
        status: { in: ["SCHEDULED", "PUBLISHING"] },
      },
    });
    if (used >= ent.maxScheduledPosts) {
      throw new QuotaExceededError({
        resource: opts.resource,
        used,
        limit: ent.maxScheduledPosts,
        message: "Scheduled post quota reached",
      });
    }
    return { used, limit: ent.maxScheduledPosts };
  }

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const used = await prisma.draft.count({
    where: {
      workspaceId: opts.workspaceId,
      createdAt: { gte: start },
      generationParams: { not: Prisma.JsonNull },
    },
  });
  if (used >= ent.maxDraftsPerMonth) {
    throw new QuotaExceededError({
      resource: opts.resource,
      used,
      limit: ent.maxDraftsPerMonth,
      message: "AI generation quota reached",
    });
  }
  return { used, limit: ent.maxDraftsPerMonth };
}
