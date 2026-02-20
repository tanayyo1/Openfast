import { PrismaClient } from "@prisma/client";
import {
  GET as listLandingPages,
  POST as createLandingPage,
} from "@/app/api/projects/[id]/landing-pages/route";
import { PATCH as patchLandingPage } from "@/app/api/projects/[id]/landing-pages/[landingPageId]/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

const prisma = new PrismaClient();
const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("landing pages API", () => {
  let userId: string;
  let workspaceId: string;
  let projectId: string;
  let originalOpenAIKey: string | undefined;
  const createdDraftIds: string[] = [];

  beforeAll(async () => {
    const seedUser = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!seedUser) throw new Error("Seed user missing. Ensure prisma db seed ran.");
    userId = seedUser.id;

    const ws = await prisma.workspace.create({
      data: {
        ownerId: userId,
        name: `Landing Pages WS ${Date.now()}`,
      },
      select: { id: true },
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId, role: "OWNER" },
    });
    await prisma.workspaceEntitlement.create({
      data: {
        workspaceId,
        maxProjects: 20,
        maxDraftsPerMonth: 9999,
        hasAdvancedAnalytics: true,
        hasSmartFinder: true,
        hasTeamFeatures: true,
      },
    });

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Landing Project",
        description: "Project to verify landing page generation routes.",
        niche: "saas",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
      },
      select: { id: true },
    });
    projectId = project.id;

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });

    originalOpenAIKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(async () => {
    if (createdDraftIds.length > 0) {
      await prisma.landingPageDraft.deleteMany({
        where: { id: { in: createdDraftIds } },
      });
    }
    await prisma.workspace.delete({ where: { id: workspaceId } });
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    await prisma.$disconnect();
  });

  test("creates workspace-scoped landing page draft", async () => {
    const res = await createLandingPage(
      new Request(`http://test.local/api/projects/${projectId}/landing-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryKeyword: "reddit growth playbook",
          audience: "indie founders",
          tone: "clear and practical",
          ctaText: "Start today",
        }),
      }),
      { params: { id: projectId } },
    );

    expect(res.status).toBe(201);
    const json = (await readJson(res)) as {
      draft: { id: string; projectId: string; slug: string; source: string };
    };
    createdDraftIds.push(json.draft.id);
    expect(json.draft.projectId).toBe(projectId);
    expect(json.draft.slug).toContain("reddit-growth-playbook");
    expect(["fallback", "openai"]).toContain(json.draft.source);
  });

  test("list is project + workspace scoped", async () => {
    const otherWorkspace = await prisma.workspace.create({
      data: {
        ownerId: userId,
        name: `Landing Pages Other ${Date.now()}`,
      },
      select: { id: true },
    });

    const otherProject = await prisma.project.create({
      data: {
        workspaceId: otherWorkspace.id,
        name: "Other Project",
        description: "Should not leak into this workspace list",
        niche: "other",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
      },
      select: { id: true },
    });

    const otherDraft = await prisma.landingPageDraft.create({
      data: {
        workspaceId: otherWorkspace.id,
        projectId: otherProject.id,
        name: "Other Draft",
        primaryKeyword: "other keyword",
        slug: "other-keyword",
        audience: "other",
        tone: "neutral",
        ctaText: "Start",
        headline: "Other headline",
        subheadline: "Other subheadline copy to satisfy constraints.",
        sections: {
          valueProps: ["v1", "v2", "v3"],
          painPoints: ["p1", "p2", "p3"],
          featureBullets: ["f1", "f2", "f3"],
          socialProof: ["s1", "s2"],
          faqs: [{ question: "q1", answer: "a1 with enough words to pass." }],
          finalCta: "Start",
        },
      },
      select: { id: true },
    });

    const listRes = await listLandingPages(
      new Request(`http://test.local/api/projects/${projectId}/landing-pages`),
      { params: { id: projectId } },
    );
    expect(listRes.status).toBe(200);
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
    };
    expect(listJson.items.some((item) => item.id === otherDraft.id)).toBe(false);

    await prisma.landingPageDraft.delete({ where: { id: otherDraft.id } });
    await prisma.project.delete({ where: { id: otherProject.id } });
    await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
  });

  test("archived drafts are hidden from default listing", async () => {
    const createRes = await createLandingPage(
      new Request(`http://test.local/api/projects/${projectId}/landing-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryKeyword: "seo launch checklist",
          audience: "startup teams",
        }),
      }),
      { params: { id: projectId } },
    );
    expect(createRes.status).toBe(201);
    const created = (await readJson(createRes)) as { draft: { id: string } };
    createdDraftIds.push(created.draft.id);

    const patchRes = await patchLandingPage(
      new Request(
        `http://test.local/api/projects/${projectId}/landing-pages/${created.draft.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        },
      ),
      { params: { id: projectId, landingPageId: created.draft.id } },
    );
    expect(patchRes.status).toBe(200);

    const listRes = await listLandingPages(
      new Request(`http://test.local/api/projects/${projectId}/landing-pages`),
      { params: { id: projectId } },
    );
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
    };
    expect(listJson.items.some((item) => item.id === created.draft.id)).toBe(false);

    const archivedListRes = await listLandingPages(
      new Request(
        `http://test.local/api/projects/${projectId}/landing-pages?includeArchived=true`,
      ),
      { params: { id: projectId } },
    );
    const archivedListJson = (await readJson(archivedListRes)) as {
      items: Array<{ id: string }>;
    };
    expect(
      archivedListJson.items.some((item) => item.id === created.draft.id),
    ).toBe(true);
  });
});
