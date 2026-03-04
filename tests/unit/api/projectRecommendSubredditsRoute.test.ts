jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueSubredditIngestJob: jest.fn(),
  enqueueSubredditComputeTimeWindowsJob: jest.fn(),
}));

jest.mock("@/lib/recommendations/ranking", () => ({
  rankSubreddits: jest.fn(),
}));

jest.mock("@/lib/subreddit/intel", () => ({
  candidateSubredditNamesForProject: jest.fn(),
  ingestSubreddit: jest.fn(),
  computeSubredditTimeWindows: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    subredditCatalog: { findMany: jest.fn() },
    workspaceEntitlement: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { POST as recommendSubreddits } from "@/app/api/projects/[id]/recommend-subreddits/route";
import { rankSubreddits } from "@/lib/recommendations/ranking";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueSubredditIngestJob: jest.Mock;
  enqueueSubredditComputeTimeWindowsJob: jest.Mock;
};
const mockedIntel = jest.requireMock("@/lib/subreddit/intel") as {
  candidateSubredditNamesForProject: jest.Mock;
  ingestSubreddit: jest.Mock;
  computeSubredditTimeWindows: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  project: { findFirst: jest.Mock };
  projectSubredditRecommendation: { findMany: jest.Mock };
  subredditCatalog: { findMany: jest.Mock };
  workspaceEntitlement: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const mockedRanking = rankSubreddits as jest.Mock;

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("recommend subreddits route", () => {
  const tx = {
    projectSubredditRecommendation: {
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.$transaction.mockImplementation(async (handler: Function) =>
      handler(tx),
    );
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
    mockedQueue.enqueueSubredditIngestJob.mockResolvedValue({
      id: "job_ing_1",
    });
    mockedQueue.enqueueSubredditComputeTimeWindowsJob.mockResolvedValue({
      id: "job_slot_1",
    });
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          subredditId: "sub_1",
          fitScore: 0.8,
          riskScore: 0.2,
          timeWindowScore: 0.8,
          compositeScore: 0.79,
          reasons: { summary: "good fit" },
          subreddit: { name: "startups", title: "Startups" },
        },
      ]);
  });

  test("writes recommendations without unsupported rank field", async () => {
    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: {},
      constraints: null,
    });
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue(["startups"]);
    mockedIntel.ingestSubreddit.mockResolvedValue({ id: "sub_1" });
    mockedIntel.computeSubredditTimeWindows.mockResolvedValue(undefined);
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([
      {
        id: "sub_1",
        name: "startups",
        title: "Startups",
        description: "startup talk",
        subscribers: 100000,
        activeUsers: 5000,
        avgPostsPerDay: 10,
        avgCommentsPerPost: 7,
        policy: {
          promoAllowed: "ALLOWED",
          linkPolicy: "ALLOWED",
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
        timeSlots: [{ score: 0.8 }],
      },
    ]);
    mockedRanking.mockReturnValue([
      {
        subredditId: "sub_1",
        fitScore: 0.8,
        riskScore: 0.2,
        timeScore: 0.8,
        totalScore: 0.79,
        reasons: { summary: "good fit" },
      },
    ]);

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalled();
    expect(
      mockedQueue.enqueueSubredditComputeTimeWindowsJob,
    ).toHaveBeenCalled();
    expect(tx.projectSubredditRecommendation.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            workspaceId: "ws_1",
            projectId: "p_1",
            subredditId: "sub_1",
            status: "CANDIDATE",
          }),
        ],
      }),
    );
    expect(tx.projectSubredditRecommendation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "ws_1",
          projectId: "p_1",
          status: { not: "SELECTED" },
        }),
      }),
    );
    const createManyArg =
      tx.projectSubredditRecommendation.createMany.mock.calls[0]?.[0];
    const first = createManyArg?.data?.[0] as Record<string, unknown>;
    expect(first).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(first, "rank")).toBe(false);
    expect(createManyArg?.skipDuplicates).toBe(true);
    expect(
      mockedPrisma.projectSubredditRecommendation.findMany,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["SELECTED", "CANDIDATE"] },
        }),
      }),
    );

    const json = (await readJson(res)) as {
      count: number;
      items: Array<{ subredditId: string }>;
    };
    expect(json.count).toBe(1);
    expect(json.items[0]?.subredditId).toBe("sub_1");
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

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("SMART_FINDER_REQUIRED");
  });

  test("preserves selected recommendations and updates their scores", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany.mockReset();
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([{ subredditId: "sub_selected" }])
      .mockResolvedValueOnce([
        {
          subredditId: "sub_selected",
          fitScore: 0.9,
          riskScore: 0.2,
          timeWindowScore: 0.75,
          compositeScore: 0.81,
          reasons: { summary: "selected" },
          subreddit: { name: "startups", title: "Startups" },
        },
      ]);

    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: {},
      constraints: null,
    });
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue(["startups"]);
    mockedIntel.ingestSubreddit.mockResolvedValue({ id: "sub_selected" });
    mockedIntel.computeSubredditTimeWindows.mockResolvedValue(undefined);
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([
      {
        id: "sub_selected",
        name: "startups",
        title: "Startups",
        description: "startup talk",
        subscribers: 100000,
        activeUsers: 5000,
        avgPostsPerDay: 10,
        avgCommentsPerPost: 7,
        policy: {
          promoAllowed: "ALLOWED",
          linkPolicy: "ALLOWED",
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
        timeSlots: [{ score: 0.8 }],
      },
    ]);
    mockedRanking.mockReturnValue([
      {
        subredditId: "sub_selected",
        fitScore: 0.9,
        riskScore: 0.2,
        timeScore: 0.75,
        totalScore: 0.81,
        reasons: { summary: "selected" },
      },
    ]);

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(tx.projectSubredditRecommendation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subredditId: "sub_selected",
          status: "SELECTED",
        }),
        data: expect.objectContaining({
          fitScore: 0.9,
          dismissedAt: null,
        }),
      }),
    );
    expect(tx.projectSubredditRecommendation.createMany).not.toHaveBeenCalled();
  });

  test("caps candidate inserts to keep total recommendations within top 5", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany.mockReset();
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([
        { subredditId: "sub_selected_1" },
        { subredditId: "sub_selected_2" },
        { subredditId: "sub_selected_3" },
        { subredditId: "sub_selected_4" },
      ])
      .mockResolvedValueOnce([
        {
          subredditId: "sub_selected_1",
          fitScore: 0.91,
          riskScore: 0.2,
          timeWindowScore: 0.75,
          compositeScore: 0.81,
          reasons: { summary: "selected 1" },
          subreddit: { name: "selected1", title: "Selected 1" },
        },
        {
          subredditId: "sub_selected_2",
          fitScore: 0.9,
          riskScore: 0.2,
          timeWindowScore: 0.75,
          compositeScore: 0.8,
          reasons: { summary: "selected 2" },
          subreddit: { name: "selected2", title: "Selected 2" },
        },
        {
          subredditId: "sub_selected_3",
          fitScore: 0.89,
          riskScore: 0.2,
          timeWindowScore: 0.75,
          compositeScore: 0.79,
          reasons: { summary: "selected 3" },
          subreddit: { name: "selected3", title: "Selected 3" },
        },
        {
          subredditId: "sub_selected_4",
          fitScore: 0.88,
          riskScore: 0.2,
          timeWindowScore: 0.75,
          compositeScore: 0.78,
          reasons: { summary: "selected 4" },
          subreddit: { name: "selected4", title: "Selected 4" },
        },
        {
          subredditId: "sub_candidate_1",
          fitScore: 0.7,
          riskScore: 0.25,
          timeWindowScore: 0.65,
          compositeScore: 0.67,
          reasons: { summary: "candidate 1" },
          subreddit: { name: "candidate1", title: "Candidate 1" },
        },
      ]);

    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: {},
      constraints: null,
    });
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue(["startups"]);
    mockedIntel.ingestSubreddit.mockResolvedValue({ id: "sub_candidate_1" });
    mockedIntel.computeSubredditTimeWindows.mockResolvedValue(undefined);
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([
      {
        id: "sub_candidate_1",
        name: "candidate1",
        title: "Candidate 1",
        description: "startup talk",
        subscribers: 100000,
        activeUsers: 5000,
        avgPostsPerDay: 10,
        avgCommentsPerPost: 7,
        policy: {
          promoAllowed: "ALLOWED",
          linkPolicy: "ALLOWED",
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
        timeSlots: [{ score: 0.8 }],
      },
    ]);
    mockedRanking.mockReturnValue([
      {
        subredditId: "sub_candidate_1",
        fitScore: 0.7,
        riskScore: 0.25,
        timeScore: 0.65,
        totalScore: 0.67,
        reasons: { summary: "candidate 1" },
      },
    ]);

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    const createManyArg =
      tx.projectSubredditRecommendation.createMany.mock.calls[0]?.[0];
    expect(createManyArg?.data).toHaveLength(1);
    expect(createManyArg?.skipDuplicates).toBe(true);
    const json = (await readJson(res)) as { count: number };
    expect(json.count).toBe(5);
  });

  test("deduplicates candidate subreddit names before ingestion", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany.mockReset();
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          subredditId: "sub_1",
          fitScore: 0.82,
          riskScore: 0.21,
          timeWindowScore: 0.79,
          compositeScore: 0.8,
          reasons: { summary: "good fit" },
          subreddit: { name: "startups", title: "Startups" },
        },
      ]);

    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: {},
      constraints: null,
    });
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue([
      "startups",
      " Startups ",
      "STARTUPS",
    ]);
    mockedIntel.ingestSubreddit.mockResolvedValue({ id: "sub_1" });
    mockedIntel.computeSubredditTimeWindows.mockResolvedValue(undefined);
    mockedPrisma.subredditCatalog.findMany.mockResolvedValue([
      {
        id: "sub_1",
        name: "startups",
        title: "Startups",
        description: "startup talk",
        subscribers: 100000,
        activeUsers: 5000,
        avgPostsPerDay: 10,
        avgCommentsPerPost: 7,
        policy: {
          promoAllowed: "ALLOWED",
          linkPolicy: "ALLOWED",
          selfPromoAllowed: true,
          affiliateAllowed: true,
        },
        timeSlots: [{ score: 0.8 }],
      },
    ]);
    mockedRanking.mockReturnValue([
      {
        subredditId: "sub_1",
        fitScore: 0.82,
        riskScore: 0.21,
        timeScore: 0.79,
        totalScore: 0.8,
        reasons: { summary: "good fit" },
      },
    ]);

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(mockedIntel.ingestSubreddit).toHaveBeenCalledTimes(1);
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledTimes(1);
    expect(mockedIntel.computeSubredditTimeWindows).toHaveBeenCalledTimes(1);
  });

  test("returns existing recommendations without mutation when all ingests fail", async () => {
    mockedPrisma.projectSubredditRecommendation.findMany.mockReset();
    mockedPrisma.projectSubredditRecommendation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          subredditId: "sub_existing",
          fitScore: 0.72,
          riskScore: 0.25,
          timeWindowScore: 0.66,
          compositeScore: 0.69,
          reasons: { summary: "existing candidate" },
          subreddit: { name: "existing", title: "Existing" },
        },
      ]);

    mockedPrisma.project.findFirst.mockResolvedValue({
      id: "p_1",
      name: "Acme",
      niche: "saas",
      goals: {},
      constraints: null,
    });
    mockedIntel.candidateSubredditNamesForProject.mockReturnValue([
      "startups",
      "saas",
    ]);
    mockedIntel.ingestSubreddit.mockRejectedValue(new Error("INGEST_FAILED"));

    const res = await recommendSubreddits(
      new Request("http://test.local/api/projects/p_1/recommend-subreddits", {
        method: "POST",
      }),
      { params: { id: "p_1" } },
    );

    expect(res.status).toBe(200);
    expect(tx.projectSubredditRecommendation.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectSubredditRecommendation.updateMany).not.toHaveBeenCalled();
    expect(tx.projectSubredditRecommendation.createMany).not.toHaveBeenCalled();
    expect(mockedPrisma.subredditCatalog.findMany).not.toHaveBeenCalled();
    expect(mockedRanking).not.toHaveBeenCalled();

    const json = (await readJson(res)) as {
      count: number;
      items: Array<{ subredditId: string }>;
    };
    expect(json.count).toBe(1);
    expect(json.items[0]?.subredditId).toBe("sub_existing");
  });
});
