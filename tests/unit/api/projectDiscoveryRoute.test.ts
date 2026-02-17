jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    subredditCatalog: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueSubredditIngestJob: jest.fn().mockResolvedValue({ id: "job_ing_1" }),
}));

jest.mock("@/lib/subreddit/intel", () => ({
  candidateSubredditNamesForProject: jest
    .fn()
    .mockReturnValue(["startups", "saas"]),
}));

import { GET as discoverSubreddits } from "@/app/api/projects/[id]/discover-subreddits/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  subredditCatalog: { findMany: jest.Mock };
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueSubredditIngestJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project subreddit discovery route (RED-62)", () => {
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

    const res = await discoverSubreddits(
      new Request("http://test.local/api/projects/p_1/discover-subreddits"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("returns 404 when project does not exist in workspace", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const res = await discoverSubreddits(
      new Request(
        "http://test.local/api/projects/p_missing/discover-subreddits",
      ),
      { params: { id: "p_missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });

  test("returns ranked discovery results and queues missing names for ingest", async () => {
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme SaaS",
      niche: "saas marketing",
      goals: { primary: "traffic" },
      constraints: null,
    });

    mockedPrisma.subredditCatalog.findMany.mockResolvedValueOnce([
      {
        id: "sub_1",
        name: "startups",
        title: "Startups",
        description: "startup growth tactics",
        subscribers: 1000000,
        activeUsers: 15000,
        avgPostsPerDay: 90,
        avgCommentsPerPost: 20,
        policy: {
          promoAllowed: "CONTEXTUAL_ONLY",
          linkPolicy: "DISALLOWED_IN_POSTS",
          selfPromoAllowed: false,
          affiliateAllowed: false,
        },
        timeSlots: [
          { score: 0.82, dayOfWeek: 2, hourUtc: 14, sampleSize: 120 },
        ],
      },
    ]);

    const res = await discoverSubreddits(
      new Request(
        "http://test.local/api/projects/p_1/discover-subreddits?q=saas&limit=5",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      projectId: string;
      count: number;
      queuedIngestNames: string[];
      items: Array<{
        subredditId: string;
        name: string;
        fitScore: number;
        riskScore: number;
        totalScore: number;
      }>;
    };

    expect(json.projectId).toBe("p_1");
    expect(json.count).toBe(1);
    expect(json.items[0]?.subredditId).toBe("sub_1");
    expect(json.items[0]?.name).toBe("startups");
    expect(json.items[0]?.fitScore).toEqual(expect.any(Number));
    expect(json.items[0]?.riskScore).toEqual(expect.any(Number));
    expect(json.items[0]?.totalScore).toEqual(expect.any(Number));
    expect(json.queuedIngestNames).toContain("saas");
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledWith({
      subredditName: "saas",
    });
  });
});
