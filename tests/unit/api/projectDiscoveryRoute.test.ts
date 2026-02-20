jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    subredditCatalog: { findMany: jest.fn() },
    workspaceEntitlement: { findUnique: jest.fn() },
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
  workspaceEntitlement: { findUnique: jest.Mock };
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueSubredditIngestJob: jest.Mock;
};
const mockedIntel = jest.requireMock("@/lib/subreddit/intel") as {
  candidateSubredditNamesForProject: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("project subreddit discovery route (RED-62)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue([
      "startups",
      "saas",
    ]);
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.workspaceEntitlement.findUnique.mockResolvedValue({
      maxProjects: 1,
      maxRedditAccounts: 1,
      maxScheduledPosts: 10,
      maxDraftsPerMonth: 10,
      roadmapDays: 7,
      hasAdvancedAnalytics: false,
      hasSmartFinder: true,
      hasTeamFeatures: false,
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

  test("returns 403 when smart finder entitlement is disabled", async () => {
    mockedPrisma.workspaceEntitlement.findUnique.mockResolvedValueOnce({
      maxProjects: 1,
      maxRedditAccounts: 1,
      maxScheduledPosts: 10,
      maxDraftsPerMonth: 10,
      roadmapDays: 7,
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
      hasTeamFeatures: false,
    });

    const res = await discoverSubreddits(
      new Request("http://test.local/api/projects/p_1/discover-subreddits"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("SMART_FINDER_REQUIRED");
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

  test("does not queue invalid subreddit tokens from query text", async () => {
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
      {
        id: "sub_2",
        name: "saas",
        title: "SaaS",
        description: "software businesses",
        subscribers: 150000,
        activeUsers: 5000,
        avgPostsPerDay: 40,
        avgCommentsPerPost: 8,
        policy: {
          promoAllowed: "ALLOWED",
          linkPolicy: "ALLOWED",
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
        timeSlots: [
          { score: 0.61, dayOfWeek: 3, hourUtc: 16, sampleSize: 80 },
        ],
      },
    ]);

    const res = await discoverSubreddits(
      new Request(
        "http://test.local/api/projects/p_1/discover-subreddits?q=ai c++ !@#&limit=5",
      ),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { queuedIngestNames: string[] };
    expect(json.queuedIngestNames).toEqual([]);
    expect(mockedQueue.enqueueSubredditIngestJob).not.toHaveBeenCalledWith({
      subredditName: "ai",
    });
  });

  test("normalizes r/ prefixed candidate names before queueing ingest", async () => {
    mockedIntel.candidateSubredditNamesForProject.mockReturnValueOnce([
      "r/Foo_Bar",
    ]);
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme SaaS",
      niche: "saas marketing",
      goals: { primary: "traffic" },
      constraints: null,
    });
    mockedPrisma.subredditCatalog.findMany.mockResolvedValueOnce([]);

    const res = await discoverSubreddits(
      new Request("http://test.local/api/projects/p_1/discover-subreddits"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { queuedIngestNames: string[] };
    expect(json.queuedIngestNames).toContain("foo_bar");
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledWith({
      subredditName: "foo_bar",
    });
  });

  test("caps queued ingest names and exposes truncation metadata", async () => {
    mockedIntel.candidateSubredditNamesForProject.mockReturnValueOnce([
      "subaaa",
      "subaab",
      "subaac",
      "subaad",
      "subaae",
      "subaaf",
      "subaag",
      "subaah",
      "subaai",
      "subaaj",
      "subaak",
      "subaal",
    ]);
    mockedPrisma.project.findFirst.mockResolvedValueOnce({
      id: "p_1",
      name: "Acme SaaS",
      niche: "saas marketing",
      goals: { primary: "traffic" },
      constraints: null,
    });
    mockedPrisma.subredditCatalog.findMany.mockResolvedValueOnce([]);

    const res = await discoverSubreddits(
      new Request("http://test.local/api/projects/p_1/discover-subreddits"),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      queuedIngestNames: string[];
      queuedIngestNamesTruncated: boolean;
      queuedIngestNamesDropped: number;
    };
    expect(json.queuedIngestNames).toHaveLength(10);
    expect(json.queuedIngestNamesTruncated).toBe(true);
    expect(json.queuedIngestNamesDropped).toBe(2);
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledTimes(10);
  });
});
