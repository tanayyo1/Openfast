import { Prisma, PrismaClient } from "@prisma/client";
import { POST as createDraft } from "@/app/api/drafts/route";
import {
  GET as getDraft,
  PATCH as patchDraft,
} from "@/app/api/drafts/[id]/route";
import { POST as requestApproval } from "@/app/api/drafts/[id]/request-approval/route";
import { POST as approveDraft } from "@/app/api/drafts/[id]/approve/route";
import { POST as rejectDraft } from "@/app/api/drafts/[id]/reject/route";

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

describe("Drafts APIs (variants + approval status)", () => {
  let workspaceId: string;
  let userId: string;

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

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("draft lifecycle: create -> request -> approve", async () => {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Draft Project",
        description: "Project for draft tests",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    const roadmap = await prisma.roadmap.create({
      data: {
        workspaceId,
        projectId: project.id,
        startDate: new Date(),
        horizonDays: 1,
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
        title: "Task",
        instructions: "Do it",
        priority: 3,
        status: "PENDING",
      },
      select: { id: true },
    });

    const createRes = await createDraft(
      new Request("http://test.local/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          taskId: task.id,
          type: "POST",
          title: "Hello",
          body: "Body",
          variants: [{ title: "V1", body: "Alt", score: 0.7 }],
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const createJson = (await readJson(createRes)) as {
      draft: { id: string; status: string };
    };
    expect(createJson.draft.status).toBe("DRAFT");
    const draftId = createJson.draft.id;

    const reqRes = await requestApproval(
      new Request(`http://test.local/api/drafts/${draftId}/request-approval`, {
        method: "POST",
      }),
      {
        params: { id: draftId },
      },
    );
    expect(reqRes.status).toBe(200);
    const reqJson = (await readJson(reqRes)) as { draft: { status: string } };
    expect(reqJson.draft.status).toBe("REVIEWING");

    const approveRes = await approveDraft(
      new Request(`http://test.local/api/drafts/${draftId}/approve`, {
        method: "POST",
      }),
      {
        params: { id: draftId },
      },
    );
    expect(approveRes.status).toBe(200);
    const approveJson = (await readJson(approveRes)) as {
      draft: { status: string; approvedBy: string };
    };
    expect(approveJson.draft.status).toBe("APPROVED");
    expect(approveJson.draft.approvedBy).toBe(userId);

    const patchRes = await patchDraft(
      new Request(`http://test.local/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "New body" }),
      }),
      { params: Promise.resolve({ id: draftId }) },
    );
    expect(patchRes.status).toBe(409);

    const getRes = await getDraft(
      new Request(`http://test.local/api/drafts/${draftId}`),
      { params: Promise.resolve({ id: draftId }) },
    );
    expect(getRes.status).toBe(200);

    const getWithStructureRes = await getDraft(
      new Request(`http://test.local/api/drafts/${draftId}?includeStructure=1`),
      { params: Promise.resolve({ id: draftId }) },
    );
    expect(getWithStructureRes.status).toBe(200);
    const getWithStructureJson = (await readJson(getWithStructureRes)) as {
      draft: { id: string };
      structure: {
        grade: string;
        score: number;
        warnings: unknown[];
        rewriteSuggestions: unknown[];
      };
    };
    expect(getWithStructureJson.structure).toBeDefined();
    expect(getWithStructureJson.structure.grade).toMatch(/^[A-F]$/);
    expect(typeof getWithStructureJson.structure.score).toBe("number");
    expect(Array.isArray(getWithStructureJson.structure.warnings)).toBe(true);
    expect(
      Array.isArray(getWithStructureJson.structure.rewriteSuggestions),
    ).toBe(true);

    await prisma.draft.deleteMany({ where: { id: draftId } });
    await prisma.roadmap.deleteMany({ where: { id: roadmap.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
  });

  test("draft lifecycle: request -> reject", async () => {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: "Draft Project 2",
        description: "Project for draft tests 2",
        niche: "test",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    const createRes = await createDraft(
      new Request("http://test.local/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          type: "COMMENT",
          body: "Comment body",
        }),
      }),
    );
    const createJson = (await readJson(createRes)) as { draft: { id: string } };
    const draftId = createJson.draft.id;

    await requestApproval(
      new Request(`http://test.local/api/drafts/${draftId}/request-approval`, {
        method: "POST",
      }),
      {
        params: { id: draftId },
      },
    );

    const rejectRes = await rejectDraft(
      new Request(`http://test.local/api/drafts/${draftId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Too promotional" }),
      }),
      { params: { id: draftId } },
    );
    expect(rejectRes.status).toBe(200);
    const rejectJson = (await readJson(rejectRes)) as {
      draft: { status: string };
    };
    expect(rejectJson.draft.status).toBe("REJECTED");

    await prisma.draft.deleteMany({ where: { id: draftId } });
    await prisma.project.deleteMany({ where: { id: project.id } });
  });
});
