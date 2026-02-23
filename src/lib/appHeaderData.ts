import type { Plan } from "@prisma/client";
import { redirect } from "next/navigation";
import { limitsForPlan } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guards";

const LOGIN_REDIRECT_ERRORS = new Set([
  "SUPABASE_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "USER_NOT_SYNCED",
]);

const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free plan",
  PRO: "Pro plan",
  ENTERPRISE: "Enterprise plan",
};

export type AppHeaderData = {
  workspaceId: string | null;
  workspaceName: string;
  planLabel: string;
  hasAdvancedAnalytics: boolean;
  hasSmartFinder: boolean;
};

export function workspacePlanLabel(plan: Plan | null | undefined): string {
  if (!plan) return PLAN_LABELS.FREE;
  return PLAN_LABELS[plan] ?? PLAN_LABELS.FREE;
}

export async function loadAppHeaderData(): Promise<AppHeaderData> {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (LOGIN_REDIRECT_ERRORS.has(code)) {
      redirect("/login");
    }
    throw error;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          plan: true,
        },
      },
    },
  });

  if (!membership?.workspace) {
    return {
      workspaceId: null,
      workspaceName: "Workspace setup",
      planLabel: "Setup pending",
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
    };
  }

  const workspace = membership.workspace;
  const limits = limitsForPlan(workspace.plan ?? "FREE");

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name.trim() || "Workspace",
    planLabel: workspacePlanLabel(workspace.plan),
    hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
    hasSmartFinder: limits.hasSmartFinder,
  };
}
