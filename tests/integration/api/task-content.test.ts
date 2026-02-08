import { Prisma, PrismaClient } from "@prisma/client";
import { POST as generateTaskContent } from "@/app/api/tasks/[id]/generate-content/route";
import {
  GET as listTaskContent,
  PATCH as patchTaskContent,
} from "@/app/api/tasks/[id]/content/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueContentGenerateJob: jest.fn(),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueContentGenerateJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Task content APIs", () => {
  let workspaceId: string;
  let userId: string;
  let counter = 0;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) throw new Error("Seed user missing. Ensure prisma db seed ran.");

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws)
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");

    userId = user.id;
    workspaceId = ws.workspaceId;
  });

  beforeEach(() => {
    mockedGuards.requireWorkspaceSession.mockReset();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
    mockedQueue.enqueueContentGenerateJob.mockReset();
    mockedQueue.enqueueContentGenerateJob.mockResolvedValue({
      id: "content_job_1",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setupTaskFixture() {
    counter += 1;
    const suffix = `${Date.now()}_${counter}`;

    const subreddit = await prisma.subredditCatalog.create({
      data: {
        name: `taskcontent_${suffix}`,
        title: `Task Content ${suffix}`,
        description: "Task content test subreddit",
        lastFetchedAt: new Date(),
      },
      select: { id: true },
    });

    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: `Task Content Project ${suffix}`,
        description: "Project for task-content tests",
        niche: "saas",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "professional", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    const roadmap = await prisma.roadmap.create({
      data: {
        workspaceId,
        projectId: project.id,
        startDate: new Date(),
        horizonDays: 7,
        version: 1,
        status: "ACTIVE",
        strategy: { approach: "test" },
      },
      select: { id: true },
    });

    const task = await prisma.roadmapTask.create({
      data: {
        workspaceId,
        roadmapId: roadmap.id,
        dayIndex: 1,
        type: "POST",
        subredditId: subreddit.id,
        title: "Share founder lesson",
        instructions: "Write a practical post with concrete outcomes.",
        priority: 3,
        status: "PENDING",
      },
      select: { id: true },
    });

    return {
      subredditId: subreddit.id,
      projectId: project.id,
      roadmapId: roadmap.id,
      taskId: task.id,
    };
  }

  async function cleanupTaskFixture(ids: {
    subredditId: string;
    projectId: string;
    roadmapId: string;
    taskId: string;
  }) {
    const drafts = await prisma.draft.findMany({
      where: { taskId: ids.taskId },
      select: { id: true },
    });
    if (drafts.length > 0) {
      await prisma.scheduledPost.deleteMany({
        where: { draftId: { in: drafts.map((d) => d.id) } },
      });
      await prisma.draft.deleteMany({
        where: { id: { in: drafts.map((d) => d.id) } },
      });
    }
    await prisma.roadmapTask.deleteMany({ where: { id: ids.taskId } });
    await prisma.roadmap.deleteMany({ where: { id: ids.roadmapId } });
    await prisma.project.deleteMany({ where: { id: ids.projectId } });
    await prisma.subredditCatalog.deleteMany({
      where: { id: ids.subredditId },
    });
  }

  test("generation success + rewrite behavior + list", async () => {
    const ids = await setupTaskFixture();
    try {
      const generateRes = await generateTaskContent(
        new Request(
          `http://test.local/api/tasks/${ids.taskId}/generate-content`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "GENERATE", variantCount: 3 }),
          },
        ),
        { params: { id: ids.taskId } },
      );
      expect(generateRes.status).toBe(202);
      const genJson = (await readJson(generateRes)) as {
        draft: { id: string };
      };
      const sourceDraftId = genJson.draft.id;

      const rewriteRes = await generateTaskContent(
        new Request(
          `http://test.local/api/tasks/${ids.taskId}/generate-content`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "REWRITE",
              sourceDraftId,
              variantCount: 3,
            }),
          },
        ),
        { params: { id: ids.taskId } },
      );
      expect(rewriteRes.status).toBe(202);
      expect(mockedQueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "REWRITE",
          sourceDraftId,
        }),
      );

      const listRes = await listTaskContent(
        new Request(`http://test.local/api/tasks/${ids.taskId}/content`),
        { params: { id: ids.taskId } },
      );
      expect(listRes.status).toBe(200);
      const listJson = (await readJson(listRes)) as {
        items: Array<{ id: string }>;
      };
      expect(listJson.items.length).toBeGreaterThanOrEqual(2);
    } finally {
      await cleanupTaskFixture(ids);
    }
  });

  test("risk metadata persistence via PATCH", async () => {
    const ids = await setupTaskFixture();
    try {
      const createRes = await generateTaskContent(
        new Request(
          `http://test.local/api/tasks/${ids.taskId}/generate-content`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "GENERATE", variantCount: 3 }),
          },
        ),
        { params: { id: ids.taskId } },
      );
      const created = (await readJson(createRes)) as { draft: { id: string } };
      const draftId = created.draft.id;

      const patchRes = await patchTaskContent(
        new Request(`http://test.local/api/tasks/${ids.taskId}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId,
            riskScore: 67,
            riskReasons: ["Contains promotional phrasing"],
            suggestedFixes: [{ issue: "CTA", fix: "Use softer ask" }],
          }),
        }),
        { params: { id: ids.taskId } },
      );
      expect(patchRes.status).toBe(200);
      const patchJson = (await readJson(patchRes)) as {
        draft: { riskScore: number; riskReasons: string[] };
      };
      expect(patchJson.draft.riskScore).toBe(67);
      expect(patchJson.draft.riskReasons).toEqual([
        "Contains promotional phrasing",
      ]);

      const persisted = await prisma.draft.findUnique({
        where: { id: draftId },
        select: { riskScore: true, riskReasons: true, suggestedFixes: true },
      });
      expect(persisted?.riskScore).toBe(67);
      expect(persisted?.riskReasons).toEqual(["Contains promotional phrasing"]);
      expect(persisted?.suggestedFixes).toBeTruthy();
    } finally {
      await cleanupTaskFixture(ids);
    }
  });

  test("invalid task/workspace and auth failure", async () => {
    const missingRes = await generateTaskContent(
      new Request("http://test.local/api/tasks/missing/generate-content", {
        method: "POST",
      }),
      { params: { id: "missing" } },
    );
    expect(missingRes.status).toBe(404);
    const missingJson = (await readJson(missingRes)) as { code: string };
    expect(missingJson.code).toBe("TASK_NOT_FOUND");

    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );
    const unauthorizedRes = await listTaskContent(
      new Request("http://test.local/api/tasks/missing/content"),
      { params: { id: "missing" } },
    );
    expect(unauthorizedRes.status).toBe(401);
  });
});
