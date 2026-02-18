import { Prisma, PrismaClient } from "@prisma/client";
import { POST as rewriteDraft } from "@/app/api/drafts/[id]/rewrite/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueContentGenerateJob: jest.fn(),
}));

jest.mock("@/lib/billing/quota", () => ({
  QuotaExceededError: class extends Error {
    code = "QUOTA_EXCEEDED";
    resource: string;
    used: number;
    limit: number;
    constructor(r: string, u: number, l: number) {
      super(`Quota exceeded for ${r}`);
      this.resource = r;
      this.used = u;
      this.limit = l;
    }
  },
  assertWorkspaceQuota: jest.fn(),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueContentGenerateJob: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  assertWorkspaceQuota: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Draft rewrite API (integration)", () => {
  let workspaceId: string;
  let userId: string;
  let projectId: string;
  let roadmapId: string;
  let taskId: string;
  let sourceDraftId: string;
  const createdDraftIds: string[] = [];

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

    // Create fixtures: project → roadmap → task → source draft
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Rewrite Integration Project",
        description: "Project for draft rewrite integration tests",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });
    projectId = project.id;

    const roadmap = await prisma.roadmap.create({
      data: {
        workspaceId,
        projectId,
        startDate: new Date(),
        horizonDays: 1,
        version: 1,
        status: "ACTIVE",
        strategy: { approach: "test" },
      },
      select: { id: true },
    });
    roadmapId = roadmap.id;

    const task = await prisma.roadmapTask.create({
      data: {
        workspaceId,
        roadmapId,
        dayIndex: 1,
        type: "POST",
        title: "Rewrite Test Task",
        instructions: "Test instructions",
        priority: 3,
        status: "PENDING",
      },
      select: { id: true },
    });
    taskId = task.id;

    const draft = await prisma.draft.create({
      data: {
        workspaceId,
        projectId,
        taskId,
        type: "POST",
        title: "Original Title",
        body: "Original body text for rewrite testing",
        mediaUrls: [],
        variants: [{ title: "V1", body: "Variant 1", score: 0.8 }],
        generationParams: Prisma.DbNull,
        status: "DRAFT",
        riskScore: 25,
        riskReasons: ["minor issue"],
        suggestedFixes: Prisma.DbNull,
      },
      select: { id: true },
    });
    sourceDraftId = draft.id;
    createdDraftIds.push(draft.id);
  });

  beforeEach(() => {
    mockedGuards.requireWorkspaceSession.mockReset();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
    mockedQueue.enqueueContentGenerateJob.mockReset();
    mockedQueue.enqueueContentGenerateJob.mockResolvedValue({
      id: "job_rewrite_integ_1",
    });
    mockedQuota.assertWorkspaceQuota.mockReset();
    mockedQuota.assertWorkspaceQuota.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.draft.deleteMany({
      where: { id: { in: createdDraftIds } },
    });
    await prisma.roadmapTask.deleteMany({ where: { id: taskId } });
    await prisma.roadmap.deleteMany({ where: { id: roadmapId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.$disconnect();
  });

  test("successful rewrite creates new draft with sourceDraftId in generationParams", async () => {
    const res = await rewriteDraft(
      new Request(`http://test.local/api/drafts/${sourceDraftId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "REWRITE",
          variantCount: 4,
          tone: "casual",
          length: "short",
        }),
      }),
      { params: Promise.resolve({ id: sourceDraftId }) },
    );

    expect(res.status).toBe(202);

    const json = (await readJson(res)) as {
      draft: { id: string; status: string };
      queue: { id: string; mode: string };
      sourceDraftId: string;
      queued: boolean;
    };
    expect(json.queued).toBe(true);
    expect(json.sourceDraftId).toBe(sourceDraftId);
    expect(json.queue.mode).toBe("REWRITE");
    expect(json.draft.id).toBeDefined();
    expect(json.draft.status).toBe("DRAFT");

    // Track for cleanup
    createdDraftIds.push(json.draft.id);

    // Verify the new draft was persisted with correct generationParams
    const newDraft = await prisma.draft.findUnique({
      where: { id: json.draft.id },
      select: { generationParams: true, taskId: true, projectId: true },
    });
    expect(newDraft).not.toBeNull();
    expect(newDraft!.taskId).toBe(taskId);
    expect(newDraft!.projectId).toBe(projectId);

    const params = newDraft!.generationParams as Record<string, unknown>;
    expect(params.sourceDraftId).toBe(sourceDraftId);
    expect(params.mode).toBe("REWRITE");
    expect(params.variantCount).toBe(4);
    expect(params.tone).toBe("casual");
    expect(params.length).toBe("short");
  });

  test("rewrite of archived draft returns 409", async () => {
    // Create an archived draft
    const archived = await prisma.draft.create({
      data: {
        workspaceId,
        projectId,
        taskId,
        type: "POST",
        title: "Archived Draft",
        body: "Archived body",
        mediaUrls: [],
        variants: Prisma.DbNull,
        generationParams: Prisma.DbNull,
        status: "ARCHIVED",
        riskScore: 0,
        riskReasons: [],
        suggestedFixes: Prisma.DbNull,
      },
      select: { id: true },
    });
    createdDraftIds.push(archived.id);

    const res = await rewriteDraft(
      new Request(`http://test.local/api/drafts/${archived.id}/rewrite`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: archived.id }) },
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_STATE");
  });

  test("rewrite of draft without task returns 409", async () => {
    // Create a draft with no task
    const noTask = await prisma.draft.create({
      data: {
        workspaceId,
        projectId,
        taskId: null,
        type: "COMMENT",
        title: null,
        body: "No-task draft body",
        mediaUrls: [],
        variants: Prisma.DbNull,
        generationParams: Prisma.DbNull,
        status: "DRAFT",
        riskScore: 0,
        riskReasons: [],
        suggestedFixes: Prisma.DbNull,
      },
      select: { id: true },
    });
    createdDraftIds.push(noTask.id);

    const res = await rewriteDraft(
      new Request(`http://test.local/api/drafts/${noTask.id}/rewrite`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: noTask.id }) },
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("TASK_REQUIRED");
  });
});
