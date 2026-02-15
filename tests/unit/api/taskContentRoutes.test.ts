jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roadmapTask: { findFirst: jest.fn() },
    draft: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subredditRule: { findFirst: jest.fn() },
  },
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueContentGenerateJob: jest.fn(),
}));

import { POST as generateContent } from "@/app/api/tasks/[id]/generate-content/route";
import {
  GET as getTaskContent,
  PATCH as patchTaskContent,
} from "@/app/api/tasks/[id]/content/route";
import { processContentGenerateJob } from "@/workers/contentWorker";
import type { Job } from "bullmq";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  roadmapTask: { findFirst: jest.Mock };
  draft: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  subredditRule: { findFirst: jest.Mock };
};
const mockedEnqueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueContentGenerateJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("task content APIs + worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("generation success enqueues content job", async () => {
    mockedPrisma.roadmapTask.findFirst.mockResolvedValue({
      id: "task_1",
      subredditId: "sub_1",
      title: "Task title",
      instructions: "Do this",
      roadmap: { project: { id: "proj_1", status: "ACTIVE" } },
    });
    mockedPrisma.draft.create.mockResolvedValue({
      id: "dr_1",
      taskId: "task_1",
      type: "POST",
      title: "Task title",
      body: "Do this",
      status: "DRAFT",
      riskScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedEnqueue.enqueueContentGenerateJob.mockResolvedValue({
      id: "job_c_1",
    });

    const res = await generateContent(
      new Request("http://test.local/api/tasks/task_1/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "GENERATE", variantCount: 3 }),
      }),
      { params: { id: "task_1" } },
    );

    expect(res.status).toBe(202);
    const json = (await readJson(res)) as { queued: boolean };
    expect(json.queued).toBe(true);
    expect(mockedEnqueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        taskId: "task_1",
        draftId: "dr_1",
        mode: "GENERATE",
      }),
    );
  });

  test("invalid task/workspace returns TASK_NOT_FOUND", async () => {
    mockedPrisma.roadmapTask.findFirst.mockResolvedValue(null);

    const res = await generateContent(
      new Request("http://test.local/api/tasks/task_x/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "GENERATE" }),
      }),
      { params: { id: "task_x" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("TASK_NOT_FOUND");
  });

  test("rewrite behavior uses source draft context", async () => {
    mockedPrisma.roadmapTask.findFirst.mockResolvedValue({
      id: "task_1",
      subredditId: "sub_1",
      title: "Task title",
      instructions: "Do this",
      roadmap: { project: { id: "proj_1", status: "ACTIVE" } },
    });
    mockedPrisma.draft.findFirst.mockResolvedValue({
      id: "src_1",
      type: "POST",
      title: "Old title",
      body: "Old body",
      status: "REJECTED",
      subredditId: "sub_1",
    });
    mockedPrisma.draft.create.mockResolvedValue({
      id: "dr_rewrite_1",
      taskId: "task_1",
      type: "POST",
      title: "Old title",
      body: "Old body",
      status: "DRAFT",
      riskScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedEnqueue.enqueueContentGenerateJob.mockResolvedValue({
      id: "job_c_rw",
    });

    const res = await generateContent(
      new Request("http://test.local/api/tasks/task_1/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "REWRITE",
          sourceDraftId: "src_1",
          variantCount: 3,
        }),
      }),
      { params: { id: "task_1" } },
    );

    expect(res.status).toBe(202);
    expect(mockedEnqueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "REWRITE",
        sourceDraftId: "src_1",
      }),
    );
  });

  test("GET + PATCH task content and invalid approved-state edit", async () => {
    mockedPrisma.roadmapTask.findFirst.mockResolvedValue({ id: "task_1" });
    mockedPrisma.draft.findMany.mockResolvedValue([
      { id: "dr_1", taskId: "task_1", title: "T", body: "B", status: "DRAFT" },
    ]);

    const getRes = await getTaskContent(
      new Request("http://test.local/api/tasks/task_1/content"),
      { params: { id: "task_1" } },
    );
    expect(getRes.status).toBe(200);

    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      status: "APPROVED",
    });

    const patchRes = await patchTaskContent(
      new Request("http://test.local/api/tasks/task_1/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: "dr_1", body: "New body" }),
      }),
      { params: { id: "task_1" } },
    );
    expect(patchRes.status).toBe(409);
    const patchJson = (await readJson(patchRes)) as { code: string };
    expect(patchJson.code).toBe("INVALID_STATE");
  });

  test("risk metadata persistence on generation worker", async () => {
    mockedPrisma.roadmapTask.findFirst.mockResolvedValue({
      id: "task_1",
      title: "Task title",
      instructions: "Share process and result",
      subreddit: { id: "sub_1", name: "startups" },
      roadmap: {
        project: {
          id: "proj_1",
          name: "ReditFast",
          status: "ACTIVE",
          brandVoice: { tone: "professional" },
        },
      },
    });
    mockedPrisma.draft.findFirst.mockResolvedValue({
      id: "dr_1",
      title: "Old",
      body: "Buy now at https://example.com",
      type: "POST",
      status: "DRAFT",
      subredditId: "sub_1",
    });
    mockedPrisma.subredditRule.findFirst.mockResolvedValue({
      rawRules: "No links and no self-promo",
    });
    mockedPrisma.draft.update.mockResolvedValue({ id: "dr_1" });

    const job = {
      data: {
        workspaceId: "ws_1",
        taskId: "task_1",
        draftId: "dr_1",
        mode: "COMPLIANCE",
        variantCount: 3,
        tone: null,
        length: "medium",
        sourceDraftId: null,
      },
    } as unknown as Job<{
      workspaceId: string;
      taskId: string;
      draftId: string;
      mode: "GENERATE" | "REWRITE" | "COMPLIANCE";
      variantCount: number;
      tone?: string | null;
      length?: "short" | "medium" | "long" | null;
      sourceDraftId?: string | null;
    }>;

    const result = await processContentGenerateJob(job);
    expect(result.status).toBe("generated");
    expect(mockedPrisma.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          riskScore: expect.any(Number),
          riskReasons: expect.arrayContaining([expect.any(String)]),
          suggestedFixes: expect.anything(),
          variants: expect.anything(),
          structureValidation: expect.objectContaining({
            grade: expect.stringMatching(/^[A-F]$/),
            score: expect.any(Number),
            warnings: expect.any(Array),
            rewriteSuggestions: expect.any(Array),
          }),
        }),
      }),
    );
  });
});
