import { PrismaClient } from "@prisma/client";
import {
  GET as listRoadmaps,
  POST as createRoadmap,
} from "@/app/api/roadmaps/route";
import { GET as getRoadmap } from "@/app/api/roadmaps/[id]/route";
import { GET as listTasks } from "@/app/api/roadmaps/[id]/tasks/route";
import { GET as getTask, PATCH as patchTask } from "@/app/api/tasks/[id]/route";

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

describe("Roadmaps + tasks APIs (workspace-scoped)", () => {
  let workspaceId: string;
  let userId: string;
  let projectId: string;
  let roadmapId: string;

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

  afterEach(async () => {
    if (roadmapId) {
      await prisma.roadmap.deleteMany({ where: { id: roadmapId } });
      roadmapId = "";
    }
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } });
      projectId = "";
    }
  });

  test("create -> list -> get -> list tasks -> update task status", async () => {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Roadmap Project",
        description: "Project for roadmap tests",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: null,
      },
      select: { id: true },
    });
    projectId = project.id;

    const createReq = new Request("http://test.local/api/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, horizonDays: 3 }),
    });
    const createRes = await createRoadmap(createReq);
    expect(createRes.status).toBe(201);
    const createJson = (await readJson(createRes)) as {
      roadmap: { id: string };
      tasksCreated: number;
    };
    expect(createJson.tasksCreated).toBe(3);
    roadmapId = createJson.roadmap.id;

    const listRes = await listRoadmaps(
      new Request("http://test.local/api/roadmaps"),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
    };
    expect(listJson.items.some((r) => r.id === roadmapId)).toBe(true);

    const getRes = await getRoadmap(
      new Request(`http://test.local/api/roadmaps/${roadmapId}`),
      {
        params: { id: roadmapId },
      },
    );
    expect(getRes.status).toBe(200);

    const tasksRes = await listTasks(
      new Request(`http://test.local/api/roadmaps/${roadmapId}/tasks`),
      {
        params: { id: roadmapId },
      },
    );
    expect(tasksRes.status).toBe(200);
    const tasksJson = (await readJson(tasksRes)) as {
      items: Array<{ id: string }>;
    };
    expect(tasksJson.items.length).toBe(3);
    const taskId = tasksJson.items[0].id;

    const patchRes = await patchTask(
      new Request(`http://test.local/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
      { params: { id: taskId } },
    );
    expect(patchRes.status).toBe(200);

    const taskRes = await getTask(
      new Request(`http://test.local/api/tasks/${taskId}`),
      {
        params: { id: taskId },
      },
    );
    expect(taskRes.status).toBe(200);
    const taskJson = (await readJson(taskRes)) as {
      task: { status: string; completedAt: string | null };
    };
    expect(taskJson.task.status).toBe("COMPLETED");
    expect(taskJson.task.completedAt).toBeTruthy();
  });
});
