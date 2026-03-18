import Link from "next/link";
import { redirect } from "next/navigation";
import { RoadmapStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildGuidedOnboardingItems } from "@/lib/onboardingGuidance";
import {
  buildOnboardingProgress,
  type OnboardingStepStatus,
} from "@/lib/onboardingProgress";
import { requireSession } from "@/lib/server/auth-guards";
import { RefreshNextActionButton } from "@/components/onboarding/RefreshNextActionButton";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";

const LOGIN_REDIRECT_ERRORS = new Set([
  "SUPABASE_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "USER_NOT_SYNCED",
]);

const statusTone: Record<OnboardingStepStatus, string> = {
  complete: "border-emerald-300 bg-emerald-50 text-emerald-700",
  current: "border-blue-300 bg-blue-50 text-blue-700",
  blocked: "border-slate-300 bg-slate-50 text-slate-700",
};

async function loadOnboardingProgress() {
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
    select: { workspaceId: true },
  });

  if (!membership) {
    return buildOnboardingProgress({
      hasWorkspace: false,
      projectCount: 0,
      activeRedditAccountCount: 0,
      activeRoadmapCount: 0,
      latestProjectId: null,
    });
  }

  const workspaceId = membership.workspaceId;
  const [projectCount, accountCount, roadmapCount, latestProject] =
    await Promise.all([
      prisma.project.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
      prisma.redditAccount.count({
        where: { workspaceId, isActive: true },
      }),
      prisma.roadmap.count({
        where: { workspaceId, status: RoadmapStatus.ACTIVE },
      }),
      prisma.project.findFirst({
        where: { workspaceId, status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);

  return buildOnboardingProgress({
    hasWorkspace: true,
    projectCount,
    activeRedditAccountCount: accountCount,
    activeRoadmapCount: roadmapCount,
    latestProjectId: latestProject?.id ?? null,
  });
}

export default async function OnboardingPage() {
  const progress = await loadOnboardingProgress();
  const guidedItems = buildGuidedOnboardingItems(progress.steps);

  return (
    <div className="space-y-8">
      <AnalyticsBeacon
        eventName="onboarding_step_hub_viewed"
        onceKey="onboarding_step_hub_viewed"
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Activation hub
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Set up your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete these steps to start monitoring subreddits and drafting
          content.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{progress.nextAction.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.completedCount} of {progress.totalCount} steps complete.
            </p>
          </div>
          {progress.nextAction.kind === "refresh" ? (
            <RefreshNextActionButton
              label={progress.nextAction.action}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            />
          ) : (
            <Link
              href={progress.nextAction.href}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              {progress.nextAction.action}
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Guided setup flow</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Follow each step in order. Estimated time to full activation is under
          10 minutes for most workspaces.
        </p>
      </div>

      <div className="grid gap-4">
        {guidedItems.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-[24px] border p-6 ${
              step.status === "current"
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card/80"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Step {index + 1} • ~{step.etaMinutes} min
                </p>
                <p className="mt-2 text-lg font-semibold">{step.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.checkpoint}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.hint}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[step.status]}`}
                >
                  {step.status}
                </span>
                {step.status === "blocked" ? (
                  <span className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground">
                    {step.action}
                  </span>
                ) : (
                  <Link
                    href={step.href}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:border-foreground/40"
                  >
                    {step.action}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Need help?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Read the onboarding guide or contact support for a live walkthrough.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/seo/guides/getting-started"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Read guide
          </Link>
          <Link
            href="/seo/guides/support"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Contact support
          </Link>
          <Link
            href="/trust-center"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Trust center
          </Link>
        </div>
      </div>
    </div>
  );
}
