jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subredditCatalog: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/subreddit/rulesFetchCache", () => ({
  fetchSubredditDataWithCache: jest.fn(),
}));

import { GET as getSubredditAnalyzerTool } from "@/app/api/tools/subreddit-analyzer/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};
const mockedRateLimit = jest.requireMock("@/lib/rateLimit/publicTools") as {
  enforcePublicToolRateLimit: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  subredditCatalog: { findUnique: jest.Mock };
};
const mockedFetch = jest.requireMock("@/lib/subreddit/rulesFetchCache") as {
  fetchSubredditDataWithCache: jest.Mock;
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

  test("fetches inline when subreddit is not cached", async () => {
    mockedPrisma.subredditCatalog.findUnique.mockResolvedValue(null);
    mockedFetch.fetchSubredditDataWithCache.mockResolvedValue({
      data: {
        name: "startups",
        title: "Startups",
        description: "Community discussions in r/startups",
        subscribers: 1000,
        activeUsers: 120,
        avgPostsPerDay: 88,
        avgCommentsPerPost: 16,
        rules: ["No blatant self-promo"],
        nsfw: false,
        isRestricted: false,
        isQuarantined: false,
      },
      source: "reddit",
      cacheHit: false,
    });

    const res = await getSubredditAnalyzerTool(
      new Request(
        "http://test.local/api/tools/subreddit-analyzer?name=r/startups",
      ),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      subreddit: { name: string };
      source: string;
      rules: string[];
      meta: { limit: number; remaining: number; resetAfterSeconds: number };
    };
    expect(json.subreddit.name).toBe("startups");
    expect(json.source).toBe("reddit");
    expect(json.rules).toContain("No blatant self-promo");
    expect(json.meta.resetAfterSeconds).toBe(60);
  });

  test("returns 502 when inline fetch fails on cache miss", async () => {
    mockedPrisma.subredditCatalog.findUnique.mockResolvedValue(null);
    mockedFetch.fetchSubredditDataWithCache.mockRejectedValue(
      new Error("SUBREDDIT_NAME_REQUIRED"),
    );

    const res = await getSubredditAnalyzerTool(
      new Request(
        "http://test.local/api/tools/subreddit-analyzer?name=r/startups",
      ),
    );

    expect(res.status).toBe(502);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("FETCH_FAILED");
  });

  test("returns cached data from database when available", async () => {
    mockedPrisma.subredditCatalog.findUnique.mockResolvedValue({
      id: "sub_1",
      name: "startups",
      title: "Startups",
      subscribers: 1000,
      activeUsers: 120,
      nsfw: false,
      isRestricted: false,
      isQuarantined: false,
      lastFetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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
      source: string;
      topTimeWindows: Array<{ dayOfWeek: number; hourUtc: number }>;
    };
    expect(json.subreddit.name).toBe("startups");
    expect(json.source).toBe("database");
    expect(json.topTimeWindows[0]).toMatchObject({ dayOfWeek: 2, hourUtc: 13 });
    expect(mockedFetch.fetchSubredditDataWithCache).not.toHaveBeenCalled();
  });
});
