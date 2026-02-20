jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueContentGenerateJob: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    threadCandidate: { findFirst: jest.fn() },
    roadmap: { findFirst: jest.fn() },
    roadmapTask: { findFirst: jest.fn(), create: jest.fn() },
    draft: { create: jest.fn() },
  },
}));

import { POST as createTaskFromOpportunity } from "@/app/api/tasks/from-opportunity/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueContentGenerateJob: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  threadCandidate: { findFirst: jest.Mock };
  roadmap: { findFirst: jest.Mock };
  roadmapTask: { findFirst: jest.Mock; create: jest.Mock };
  draft: { create: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("tasks from opportunity route (RED-59)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("returns 401 when auth guard fails", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_1",
          opportunityId: "opp_1",
        }),
      }),
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("returns 404 when project is missing", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_missing",
          opportunityId: "opp_1",
        }),
      }),
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });

  test("returns 409 when no recommendations exist for project", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([]);

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_1",
          opportunityId: "opp_1",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("RECOMMENDATIONS_REQUIRED");
  });

  test("returns 404 when opportunity is outside recommended subreddit scope", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        subredditId: "sub_1",
        fitScore: 0.73,
        compositeScore: 0.61,
        subreddit: { name: "startups", title: "Startups" },
      },
    ]);
    mockedPrisma.threadCandidate.findFirst.mockResolvedValueOnce(null);

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_1",
          opportunityId: "opp_outside",
        }),
      }),
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("OPPORTUNITY_NOT_FOUND");
  });

  test("creates comment task and draft and queues content generation", async () => {
    const now = new Date("2026-02-20T17:15:00.000Z");
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        subredditId: "sub_1",
        fitScore: 0.73,
        compositeScore: 0.61,
        subreddit: { name: "startups", title: "Startups" },
      },
    ]);
    mockedPrisma.threadCandidate.findFirst.mockResolvedValueOnce({
      id: "opp_1",
      subredditId: "sub_1",
      title: "How to improve onboarding completion?",
      permalink: "https://reddit.com/r/startups/comments/abc123",
      score: 0.85,
      subreddit: { id: "sub_1", name: "startups", title: "Startups" },
    });
    mockedPrisma.roadmap.findFirst.mockResolvedValueOnce({ id: "rm_1" });
    mockedPrisma.roadmapTask.findFirst.mockResolvedValueOnce({ dayIndex: 6 });
    mockedPrisma.roadmapTask.create.mockResolvedValueOnce({
      id: "task_1",
      roadmapId: "rm_1",
      dayIndex: 7,
      type: "COMMENT",
      subredditId: "sub_1",
      fitScore: 0.73,
      title: "Comment on: How to improve onboarding completion?",
      instructions:
        "Reply with a value-first comment on this thread:\nhttps://reddit.com/r/startups/comments/abc123",
      status: "PENDING",
      createdAt: now,
    });
    mockedPrisma.draft.create.mockResolvedValueOnce({
      id: "dr_1",
      taskId: "task_1",
      projectId: "p_1",
      subredditId: "sub_1",
      type: "COMMENT",
      title: null,
      body: "seed",
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    });
    mockedQueue.enqueueContentGenerateJob.mockResolvedValueOnce({ id: "job_1" });

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_1",
          opportunityId: "opp_1",
          variantCount: 3,
        }),
      }),
    );

    expect(res.status).toBe(202);
    const json = (await readJson(res)) as {
      projectId: string;
      opportunityId: string;
      queued: boolean;
      queue: { id: string; mode: string };
      task: { id: string; dayIndex: number; type: string };
      draft: { id: string; taskId: string; type: string };
    };
    expect(json.projectId).toBe("p_1");
    expect(json.opportunityId).toBe("opp_1");
    expect(json.queued).toBe(true);
    expect(json.queue.id).toBe("job_1");
    expect(json.task.id).toBe("task_1");
    expect(json.task.dayIndex).toBe(7);
    expect(json.task.type).toBe("COMMENT");
    expect(json.draft.id).toBe("dr_1");
    expect(json.draft.type).toBe("COMMENT");
    expect(mockedPrisma.roadmapTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COMMENT",
          subredditId: "sub_1",
          dayIndex: 7,
        }),
      }),
    );
    expect(mockedQueue.enqueueContentGenerateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        taskId: "task_1",
        draftId: "dr_1",
        mode: "GENERATE",
        variantCount: 3,
      }),
    );
  });

  test("returns 201 with warning when queue enqueue fails", async () => {
    const now = new Date("2026-02-20T17:30:00.000Z");
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme",
    });
    mockedPrisma.projectSubredditRecommendation.findMany.mockResolvedValueOnce([
      {
        subredditId: "sub_1",
        fitScore: 0.73,
        compositeScore: 0.61,
        subreddit: { name: "startups", title: "Startups" },
      },
    ]);
    mockedPrisma.threadCandidate.findFirst.mockResolvedValueOnce({
      id: "opp_1",
      subredditId: "sub_1",
      title: "How to improve onboarding completion?",
      permalink: "https://reddit.com/r/startups/comments/abc123",
      score: 0.85,
      subreddit: { id: "sub_1", name: "startups", title: "Startups" },
    });
    mockedPrisma.roadmap.findFirst.mockResolvedValueOnce({ id: "rm_1" });
    mockedPrisma.roadmapTask.findFirst.mockResolvedValueOnce({ dayIndex: 2 });
    mockedPrisma.roadmapTask.create.mockResolvedValueOnce({
      id: "task_1",
      roadmapId: "rm_1",
      dayIndex: 3,
      type: "COMMENT",
      subredditId: "sub_1",
      fitScore: 0.73,
      title: "Comment on: How to improve onboarding completion?",
      instructions: "x",
      status: "PENDING",
      createdAt: now,
    });
    mockedPrisma.draft.create.mockResolvedValueOnce({
      id: "dr_1",
      taskId: "task_1",
      projectId: "p_1",
      subredditId: "sub_1",
      type: "COMMENT",
      title: null,
      body: "seed",
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    });
    mockedQueue.enqueueContentGenerateJob.mockRejectedValueOnce(
      new Error("queue unavailable"),
    );

    const res = await createTaskFromOpportunity(
      new Request("http://test.local/api/tasks/from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "p_1",
          opportunityId: "opp_1",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = (await readJson(res)) as { queued: boolean; warning: string };
    expect(json.queued).toBe(false);
    expect(json.warning).toMatch(/queue is unavailable/i);
  });
});
