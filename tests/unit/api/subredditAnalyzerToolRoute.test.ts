jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subredditCatalog: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueSubredditIngestJob: jest.fn(),
  enqueueSubredditComputeTimeWindowsJob: jest.fn(),
}));

import { GET as getSubredditAnalyzerTool } from "@/app/api/tools/subreddit-analyzer/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};
const mockedRateLimit = jest.requireMock("@/lib/rateLimit/publicTools") as {
  enforcePublicToolRateLimit: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  subredditCatalog: { findFirst: jest.Mock };
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueSubredditIngestJob: jest.Mock;
  enqueueSubredditComputeTimeWindowsJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("subreddit-analyzer tool route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    mockedRateLimit.enforcePublicToolRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAfterSeconds: 60,
    });
    mockedQueue.enqueueSubredditIngestJob.mockResolvedValue({
      id: "job_ingest",
    });
    mockedQueue.enqueueSubredditComputeTimeWindowsJob.mockResolvedValue({
      id: "job_windows",
    });
  });

  test("returns 400 when subreddit name has invalid format", async () => {
    const res = await getSubredditAnalyzerTool(
      new Request(
        "http://test.local/api/tools/subreddit-analyzer?name=r/start ups",
      ),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string; error: string };
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.error).toBe("Invalid query params");
  });

  test("queues ingest when subreddit is not cached", async () => {
    mockedPrisma.subredditCatalog.findFirst.mockResolvedValue(null);

    const res = await getSubredditAnalyzerTool(
      new Request(
        "http://test.local/api/tools/subreddit-analyzer?name=r/startups",
      ),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      queued: boolean;
      message: string;
      meta: { limit: number; remaining: number; resetAfterSeconds: number };
    };
    expect(json.queued).toBe(true);
    expect(json.message).toContain("Ingest queued");
    expect(json.meta.resetAfterSeconds).toBe(60);
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledWith({
      subredditName: "startups",
    });
  });

  test("returns cached data and queues refresh when stale", async () => {
    mockedPrisma.subredditCatalog.findFirst.mockResolvedValue({
      id: "sub_1",
      name: "startups",
      title: "Startups",
      subscribers: 1000,
      activeUsers: 120,
      nsfw: false,
      isRestricted: false,
      isQuarantined: false,
      lastFetchedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      policy: {
        promoAllowed: false,
        linkPolicy: "DISALLOWED_IN_POSTS",
        flairRequired: true,
        noLinksInPosts: true,
        textOnly: true,
      },
      rules: [{ fetchedAt: new Date() }],
      timeSlots: [{ dayOfWeek: 2, hourUtc: 13, score: 0.78 }],
    });

    const res = await getSubredditAnalyzerTool(
      new Request(
        "http://test.local/api/tools/subreddit-analyzer?name=startups",
      ),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      subreddit: { name: string };
      staleHours: number;
      queuedRefresh: boolean;
      topTimeWindows: Array<{ dayOfWeek: number; hourUtc: number }>;
    };
    expect(json.subreddit.name).toBe("startups");
    expect(json.staleHours).toBeGreaterThanOrEqual(24);
    expect(json.queuedRefresh).toBe(true);
    expect(json.topTimeWindows[0]).toMatchObject({ dayOfWeek: 2, hourUtc: 13 });
    expect(mockedQueue.enqueueSubredditIngestJob).toHaveBeenCalledTimes(1);
    expect(
      mockedQueue.enqueueSubredditComputeTimeWindowsJob,
    ).toHaveBeenCalledWith({ subredditId: "sub_1" });
  });
});
