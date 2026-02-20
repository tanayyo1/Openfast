import { prisma } from "@/lib/prisma";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";
import { RedditAdsCampaignManager } from "@/components/app/ads/RedditAdsCampaignManager";

export default async function AdsPage() {
  const session = await requireWorkspaceSessionForPage();

  const [projects, redditAccounts, campaigns] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: session.workspaceId, status: { not: "ARCHIVED" } },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, name: true },
      take: 100,
    }),
    prisma.redditAccount.findMany({
      where: { workspaceId: session.workspaceId, isActive: true },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, redditUsername: true },
      take: 50,
    }),
    prisma.redditAdCampaign.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        projectId: true,
        redditAccountId: true,
        name: true,
        objective: true,
        status: true,
        dailyBudgetCents: true,
        lifetimeBudgetCents: true,
        targetSubreddits: true,
        targetCountries: true,
        headline: true,
        body: true,
        destinationUrl: true,
        launchedAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        redditAccount: {
          select: {
            id: true,
            redditUsername: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Reddit Ads
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Campaign planner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          RED-52 foundation: plan, validate, and manage Reddit ad campaigns with
          workspace-scoped controls before enabling external ad network sync.
        </p>
      </div>

      <RedditAdsCampaignManager
        projects={projects}
        redditAccounts={redditAccounts}
        initialCampaigns={campaigns.map((campaign) => ({
          ...campaign,
          launchedAt: campaign.launchedAt?.toISOString() ?? null,
          archivedAt: campaign.archivedAt?.toISOString() ?? null,
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
