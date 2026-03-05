import { LandingPageManager } from "@/components/app/landingPages/LandingPageManager";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

export default async function LandingPagesPage() {
  const session = await requireWorkspaceSessionForPage();

  const [projects, drafts] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: session.workspaceId, status: { not: "ARCHIVED" } },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, name: true, niche: true },
      take: 100,
    }),
    prisma.landingPageDraft.findMany({
      where: { workspaceId: session.workspaceId, archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        projectId: true,
        name: true,
        primaryKeyword: true,
        slug: true,
        audience: true,
        tone: true,
        ctaText: true,
        headline: true,
        subheadline: true,
        sections: true,
        metaTitle: true,
        metaDescription: true,
        source: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Landing Pages
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Landing page generator</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate conversion-ready landing page copy from your workspace
          projects.
        </p>
      </div>

      <LandingPageManager
        projects={projects}
        initialDrafts={drafts.map((draft) => ({
          ...draft,
          archivedAt: draft.archivedAt?.toISOString() ?? null,
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
