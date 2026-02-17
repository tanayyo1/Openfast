jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectPainPoint: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/painPoints/generate", () => ({
  generateProjectPainPoints: jest.fn(),
}));

import {
  GET as listPainPoints,
  POST as extractPainPoints,
} from "@/app/api/projects/[id]/pain-points/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectPainPoint: { findMany: jest.Mock };
};
const mockedGenerate = jest.requireMock("@/lib/painPoints/generate") as {
  generateProjectPainPoints: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project pain-points route (RED-56)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("GET returns 404 when project is missing", async () => {
    mockedPrisma.project.findFirst.mockResolvedValue(null);

    const res = await listPainPoints(
      new Request("http://test.local/api/projects/p_missing/pain-points"),
      { params: { id: "p_missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });

  test("GET returns project pain points", async () => {
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1" });
    mockedPrisma.projectPainPoint.findMany.mockResolvedValue([
      {
        id: "pp_1",
        subredditId: "sub_1",
        phrase: "struggling with onboarding activation",
        normalizedPhrase: "struggling with onboarding activation",
        severityScore: 0.82,
        confidenceScore: 0.71,
        frequency: 3,
        evidenceCount: 3,
        sampleTitles: ["Struggling with onboarding activation in SaaS"],
        sourceThreadIds: ["t3_abc"],
        createdAt: new Date("2026-02-17T00:00:00.000Z"),
        updatedAt: new Date("2026-02-17T00:00:00.000Z"),
        subreddit: { id: "sub_1", name: "startups", title: "Startups" },
      },
    ]);

    const res = await listPainPoints(
      new Request("http://test.local/api/projects/p_1/pain-points"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      projectId: string;
      count: number;
      items: Array<{ id: string; phrase: string }>;
    };
    expect(json.projectId).toBe("p_1");
    expect(json.count).toBe(1);
    expect(json.items[0]?.id).toBe("pp_1");
  });

  test("POST triggers extraction and returns summary", async () => {
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1" });
    mockedGenerate.generateProjectPainPoints.mockResolvedValue({
      project: { id: "p_1", name: "Acme" },
      extracted: 2,
      subreddits: 1,
      items: [
        {
          id: "pp_1",
          subredditId: "sub_1",
          phrase: "how to get first users",
          severityScore: 0.7,
          confidenceScore: 0.66,
          frequency: 2,
        },
      ],
    });

    const res = await extractPainPoints(
      new Request("http://test.local/api/projects/p_1/pain-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perSubredditLimit: 6 }),
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      extracted: number;
      subredditCount: number;
    };
    expect(json.extracted).toBe(2);
    expect(json.subredditCount).toBe(1);
    expect(mockedGenerate.generateProjectPainPoints).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      projectId: "p_1",
      perSubredditLimit: 6,
    });
  });

  test("POST returns 404 when project disappears before extraction", async () => {
    mockedPrisma.project.findFirst.mockResolvedValue({ id: "p_1" });
    mockedGenerate.generateProjectPainPoints.mockRejectedValue(
      new Error("PROJECT_NOT_FOUND"),
    );

    const res = await extractPainPoints(
      new Request("http://test.local/api/projects/p_1/pain-points", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });
});
