jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";

const mockedRedisModule = jest.requireMock("@/lib/redis") as {
  getRedis: jest.Mock;
};

describe("subreddit rules fetch cache", () => {
  const originalFetch = global.fetch;
  const originalTtl = process.env.SUBREDDIT_RULES_CACHE_TTL_SECONDS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUBREDDIT_RULES_CACHE_TTL_SECONDS = "60";
  });

  afterEach(() => {
    if (originalTtl === undefined) {
      delete process.env.SUBREDDIT_RULES_CACHE_TTL_SECONDS;
      return;
    }
    process.env.SUBREDDIT_RULES_CACHE_TTL_SECONDS = originalTtl;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("returns cached payload when redis has entry", async () => {
    const get = jest.fn().mockResolvedValue(
      JSON.stringify({
        version: 1,
        cachedAt: new Date().toISOString(),
        source: "reddit",
        data: {
          name: "startups",
          title: "Startups",
          description: "Startup discussions",
          subscribers: 100,
          activeUsers: 10,
          avgPostsPerDay: 8,
          avgCommentsPerPost: 3,
          rules: ["No spam"],
          nsfw: false,
          isRestricted: false,
          isQuarantined: false,
        },
      }),
    );
    const setex = jest.fn();
    mockedRedisModule.getRedis.mockReturnValue({ get, setex });
    global.fetch = jest.fn();

    const result = await fetchSubredditDataWithCache("r/startups");

    expect(result.cacheHit).toBe(true);
    expect(result.source).toBe("reddit");
    expect(result.data.name).toBe("startups");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fetches from reddit and writes redis cache on miss", async () => {
    const get = jest.fn().mockResolvedValue(null);
    const setex = jest.fn().mockResolvedValue("OK");
    mockedRedisModule.getRedis.mockReturnValue({ get, setex });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            display_name: "SaaS",
            title: "SaaS",
            public_description: "SaaS makers",
            subscribers: 180000,
            active_user_count: 1200,
            over18: false,
            subreddit_type: "public",
            quarantine: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [{ short_name: "No spam", description: "No self promotion" }],
        }),
      });

    const result = await fetchSubredditDataWithCache("saas");

    expect(result.cacheHit).toBe(false);
    expect(result.source).toBe("reddit");
    expect(result.data.name).toBe("saas");
    expect(result.data.rules[0]).toContain("No spam");
    expect(setex).toHaveBeenCalledTimes(1);
  });

  test("falls back to seeded defaults when reddit fetch fails", async () => {
    const get = jest.fn().mockResolvedValue(null);
    const setex = jest.fn().mockResolvedValue("OK");
    mockedRedisModule.getRedis.mockReturnValue({ get, setex });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await fetchSubredditDataWithCache("marketing");

    expect(result.source).toBe("fallback");
    expect(result.cacheHit).toBe(false);
    expect(result.data.name).toBe("marketing");
    expect(result.data.rules.length).toBeGreaterThan(0);
    expect(setex).toHaveBeenCalledTimes(1);
  });

  test("uses in-memory cache when redis is unavailable", async () => {
    mockedRedisModule.getRedis.mockReturnValue(null);
    const fetchMock = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            display_name: "saas",
            title: "SaaS",
            public_description: "SaaS makers",
            subscribers: 180000,
            active_user_count: 1200,
            over18: false,
            subreddit_type: "public",
            quarantine: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            display_name: "saas",
            title: "SaaS",
            public_description: "SaaS makers",
            subscribers: 180000,
            active_user_count: 1200,
            over18: false,
            subreddit_type: "public",
            quarantine: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [{ short_name: "No spam", description: "No self promotion" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            display_name: "saas",
            title: "SaaS",
            public_description: "SaaS makers",
            subscribers: 180000,
            active_user_count: 1200,
            over18: false,
            subreddit_type: "public",
            quarantine: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [{ short_name: "No spam", description: "No self promotion" }],
        }),
      });

    global.fetch = fetchMock as unknown as typeof global.fetch;

    const first = await fetchSubredditDataWithCache("saas");
    expect(first.cacheHit).toBe(false);
    expect(first.source).toBe("reddit");

    const second = await fetchSubredditDataWithCache("saas");
    expect(second.cacheHit).toBe(true);
    expect(second.source).toBe("reddit");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const third = await fetchSubredditDataWithCache("saas", {
      forceRefresh: true,
    });
    expect(third.cacheHit).toBe(false);
    expect(third.source).toBe("reddit");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
