jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

class MockQuotaExceededError extends Error {
  code: string;
  resource: string;
  used: number;
  limit: number;

  constructor(resource: string, used: number, limit: number) {
    super(`Quota exceeded for ${resource}`);
    this.code = "QUOTA_EXCEEDED";
    this.resource = resource;
    this.used = used;
    this.limit = limit;
  }
}

jest.mock("@/lib/billing/quota", () => ({
  QuotaExceededError: MockQuotaExceededError,
  assertWorkspaceQuota: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueContentGenerateJob: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    draft: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { POST as rewriteDraft } from "@/app/api/drafts/[id]/rewrite/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQuota = jest.requireMock("@/lib/billing/quota") as {
  assertWorkspaceQuota: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueContentGenerateJob: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  draft: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("draft rewrite route (RED-41)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedQuota.assertWorkspaceQuota.mockResolvedValue(undefined);
  });

  test("returns unauthorized when session is missing", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(401);
  });

  test("returns 404 when source draft is not found", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce(null);

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_missing/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_missing" }) },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("NOT_FOUND");
  });

  test("returns 409 when source draft has no task", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: null,
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: [],
      status: "DRAFT",
      project: { status: "ACTIVE" },
    });

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("TASK_REQUIRED");
  });

  test("returns 403 when AI quota is exceeded", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: "task_1",
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: [],
      status: "DRAFT",
      project: { status: "ACTIVE" },
    });
    mockedQuota.assertWorkspaceQuota.mockRejectedValueOnce(
      new MockQuotaExceededError("ai_generations", 100, 100),
    );

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("QUOTA_EXCEEDED");
  });

  test("creates a new draft and enqueues REWRITE job", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: "task_1",
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: [],
      status: "REJECTED",
      project: { status: "ACTIVE" },
    });
    mockedPrisma.draft.create.mockResolvedValueOnce({
      id: "dr_rewrite_1",
      taskId: "task_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      status: "DRAFT",
      riskScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedQueue.enqueueContentGenerateJob.mockResolvedValueOnce({
      id: "job_rw_1",
    });

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "REWRITE",
          variantCount: 3,
          length: "short",
        }),
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(202);
    const json = (await readJson(res)) as {
      queued: boolean;
      sourceDraftId: string;
      queue: { mode: string };
    };
    expect(json.queued).toBe(true);
    expect(json.sourceDraftId).toBe("dr_1");
    expect(json.queue.mode).toBe("REWRITE");

    expect(mockedQueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task_1",
        sourceDraftId: "dr_1",
        mode: "REWRITE",
        length: "short",
      }),
    );
    expect(mockedPrisma.draft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaUrls: [],
          generationParams: expect.objectContaining({
            mode: "REWRITE",
            variantCount: 3,
            length: "short",
            sourceDraftId: "dr_1",
          }),
        }),
      }),
    );
  });

  test("returns 409 when source draft is archived", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: "task_1",
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: [],
      status: "ARCHIVED",
      project: { status: "ACTIVE" },
    });

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_STATE");
  });

  test("returns 409 when source project is archived", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: "task_1",
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: [],
      status: "DRAFT",
      project: { status: "ARCHIVED" },
    });

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_STATE");
  });

  test("trims tone before persistence and enqueue", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      workspaceId: "ws_1",
      projectId: "p_1",
      taskId: "task_1",
      subredditId: "sub_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      mediaUrls: ["https://cdn.test/a.png"],
      status: "DRAFT",
      project: { status: "ACTIVE" },
    });
    mockedPrisma.draft.create.mockResolvedValueOnce({
      id: "dr_rewrite_2",
      taskId: "task_1",
      type: "POST",
      title: "Original",
      body: "Original body",
      status: "DRAFT",
      riskScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedQueue.enqueueContentGenerateJob.mockResolvedValueOnce({
      id: "job_rw_2",
    });

    const res = await rewriteDraft(
      new Request("http://test.local/api/drafts/dr_1/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "COMPLIANCE",
          tone: "  professional  ",
        }),
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );
    expect(res.status).toBe(202);
    expect(mockedPrisma.draft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaUrls: ["https://cdn.test/a.png"],
          generationParams: expect.objectContaining({
            mode: "COMPLIANCE",
            tone: "professional",
          }),
        }),
      }),
    );
    expect(mockedQueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "COMPLIANCE",
        tone: "professional",
      }),
    );
  });
});
