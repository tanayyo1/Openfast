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
});
