import { Prisma, PrismaClient } from "@prisma/client";
import {
  GET as listProjects,
  POST as createProject,
} from "@/app/api/projects/route";
import {
  DELETE as archiveProject,
  GET as getProject,
  PATCH as updateProject,
} from "@/app/api/projects/[id]/route";

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

describe("Projects API (workspace-scoped)", () => {
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) {
      throw new Error("Seed user missing. Ensure prisma db seed ran.");
    }

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws) {
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");
    }

    userId = user.id;
    workspaceId = ws.workspaceId;
    await prisma.workspaceEntitlement.upsert({
      where: { workspaceId },
      update: { maxProjects: 50 },
      create: {
        workspaceId,
        maxProjects: 50,
        maxRedditAccounts: 10,
        maxScheduledPosts: 200,
        maxDraftsPerMonth: 2000,
        roadmapDays: 30,
        hasAdvancedAnalytics: true,
        hasSmartFinder: true,
        hasTeamFeatures: false,
      },
    });

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("create -> list -> get -> patch -> delete", async () => {
    const createReq = new Request("http://test.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Project",
        description: "Test description",
        niche: "test",
      }),
    });

    const createdRes = await createProject(createReq);
    expect(createdRes.status).toBe(201);
    const createdJson = (await readJson(createdRes)) as {
      project: { id: string };
    };
    expect(createdJson?.project?.id).toBeTruthy();
    const projectId = createdJson.project.id;

    const listRes = await listProjects(
      new Request("http://test.local/api/projects"),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(listJson.items.some((p) => p.id === projectId)).toBe(true);

    const getRes = await getProject(
      new Request(`http://test.local/api/projects/${projectId}`),
      {
        params: { id: projectId },
      },
    );
    expect(getRes.status).toBe(200);
    const getJson = (await readJson(getRes)) as {
      project: { id: string; name: string };
    };
    expect(getJson.project.id).toBe(projectId);
    expect(getJson.project.name).toBe("Test Project");

    const patchReq = new Request(
      `http://test.local/api/projects/${projectId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      },
    );
    const patchRes = await updateProject(patchReq, {
      params: { id: projectId },
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await readJson(patchRes)) as {
      project: { status: string };
    };
    expect(patchJson.project.status).toBe("PAUSED");

    const deleteRes = await archiveProject(
      new Request(`http://test.local/api/projects/${projectId}`, {
        method: "DELETE",
      }),
      {
        params: { id: projectId },
      },
    );
    expect(deleteRes.status).toBe(200);

    const archived = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    expect(archived?.status).toBe("ARCHIVED");
  });

  test("list is scoped to workspace", async () => {
    const otherWs = await prisma.workspace.create({
      data: {
        name: "Other Workspace",
        ownerId: userId,
      },
      select: { id: true },
    });

    const otherProject = await prisma.project.create({
      data: {
        workspaceId: otherWs.id,
        name: "Other Project",
        description: "Hidden",
        niche: "other",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    const listRes = await listProjects(
      new Request("http://test.local/api/projects"),
    );
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
    };
    expect(listJson.items.some((p) => p.id === otherProject.id)).toBe(false);

    await prisma.project.delete({ where: { id: otherProject.id } });
    await prisma.workspace.delete({ where: { id: otherWs.id } });
  });

  test("patch/delete writes are workspace scoped", async () => {
    const otherWs = await prisma.workspace.create({
      data: {
        name: "Other Workspace For Write Scope",
        ownerId: userId,
      },
      select: { id: true },
    });

    const otherProject = await prisma.project.create({
      data: {
        workspaceId: otherWs.id,
        name: "Other Project Write Scope",
        description: "Hidden",
        niche: "other",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true, status: true },
    });

    const patchRes = await updateProject(
      new Request(`http://test.local/api/projects/${otherProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      }),
      { params: { id: otherProject.id } },
    );
    expect(patchRes.status).toBe(404);

    const deleteRes = await archiveProject(
      new Request(`http://test.local/api/projects/${otherProject.id}`, {
        method: "DELETE",
      }),
      { params: { id: otherProject.id } },
    );
    expect(deleteRes.status).toBe(404);

    const stillActive = await prisma.project.findUnique({
      where: { id: otherProject.id },
      select: { status: true },
    });
    expect(stillActive?.status).toBe("ACTIVE");

    await prisma.project.delete({ where: { id: otherProject.id } });
    await prisma.workspace.delete({ where: { id: otherWs.id } });
  });

  test("concurrent create requests respect quota without race", async () => {
    await prisma.workspaceEntitlement.update({
      where: { workspaceId },
      data: { maxProjects: 1 },
    });
    await prisma.project.deleteMany({ where: { workspaceId } });

    const makeCreateReq = (name: string) =>
      new Request("http://test.local/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: "Race check",
          niche: "test",
        }),
      });

    const [a, b] = await Promise.all([
      createProject(makeCreateReq("Race Project A")),
      createProject(makeCreateReq("Race Project B")),
    ]);

    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 403]);

    const used = await prisma.project.count({
      where: { workspaceId, status: { not: "ARCHIVED" } },
    });
    expect(used).toBe(1);

    await prisma.project.deleteMany({ where: { workspaceId } });
    await prisma.workspaceEntitlement.update({
      where: { workspaceId },
      data: { maxProjects: 50 },
    });
  });

  test("normalizes URL input on create and patch", async () => {
    const createReq = new Request("http://test.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "URL Normalization Project",
        description: "Checks URL normalization behavior",
        url: "example.com/pricing",
        niche: "saas",
      }),
    });

    const createdRes = await createProject(createReq);
    expect(createdRes.status).toBe(201);
    const createdJson = (await readJson(createdRes)) as {
      project: { id: string; url: string | null };
    };
    const projectId = createdJson.project.id;
    expect(createdJson.project.url).toBe("https://example.com/pricing");

    const patchReq = new Request(
      `http://test.local/api/projects/${projectId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: " https://example.com/docs ",
        }),
      },
    );
    const patchRes = await updateProject(patchReq, {
      params: { id: projectId },
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await readJson(patchRes)) as {
      project: { url: string | null };
    };
    expect(patchJson.project.url).toBe("https://example.com/docs");

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ARCHIVED" },
      select: { id: true },
    });
  });

  test("rejects invalid single-label hostnames in URL fields", async () => {
    const invalidCreateReq = new Request("http://test.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Invalid URL Hostname Project",
        description: "This should fail URL validation.",
        url: "notaurl",
        niche: "saas",
      }),
    });
    const invalidCreateRes = await createProject(invalidCreateReq);
    expect(invalidCreateRes.status).toBe(400);
    const invalidCreateJson = (await readJson(invalidCreateRes)) as {
      code?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    expect(invalidCreateJson.code).toBe("VALIDATION_ERROR");
    expect(invalidCreateJson.details?.fieldErrors?.url?.[0]).toMatch(
      /valid http\(s\) URL/i,
    );

    const validCreateReq = new Request("http://test.local/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid URL Hostname Project",
        description: "Create a project so patch validation can be exercised.",
        url: "example.com",
        niche: "saas",
      }),
    });
    const validCreateRes = await createProject(validCreateReq);
    expect(validCreateRes.status).toBe(201);
    const validCreateJson = (await readJson(validCreateRes)) as {
      project: { id: string };
    };

    const invalidPatchReq = new Request(
      `http://test.local/api/projects/${validCreateJson.project.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "internal-service",
        }),
      },
    );
    const invalidPatchRes = await updateProject(invalidPatchReq, {
      params: { id: validCreateJson.project.id },
    });
    expect(invalidPatchRes.status).toBe(400);
    const invalidPatchJson = (await readJson(invalidPatchRes)) as {
      code?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    expect(invalidPatchJson.code).toBe("VALIDATION_ERROR");
    expect(invalidPatchJson.details?.fieldErrors?.url?.[0]).toMatch(
      /valid http\(s\) URL/i,
    );

    await prisma.project.update({
      where: { id: validCreateJson.project.id },
      data: { status: "ARCHIVED" },
      select: { id: true },
    });
  });
});
