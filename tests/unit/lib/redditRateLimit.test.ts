import { enforceRedditAccountRateLimit } from "@/lib/reddit/client";

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

const mockedRedis = jest.requireMock("@/lib/redis") as {
  getRedis: jest.Mock;
};

describe("reddit rate limit enforcement", () => {
  const nowMs = 60_000; // stable window boundary

  beforeEach(() => {
    mockedRedis.getRedis.mockReset();
  });

  test("returns remaining when under limit", async () => {
    const incr = jest.fn().mockResolvedValue(1);
    const expire = jest.fn().mockResolvedValue(1);
    mockedRedis.getRedis.mockReturnValue({ incr, expire });

    const out = await enforceRedditAccountRateLimit({
      redditAccountId: "ra_1",
      nowMs,
      limit: 2,
      windowSeconds: 60,
    });
    expect(out.remaining).toBe(1);
    expect(incr).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });

  test("throws retryable error when above limit", async () => {
    const incr = jest.fn().mockResolvedValue(3);
    const expire = jest.fn().mockResolvedValue(1);
    mockedRedis.getRedis.mockReturnValue({ incr, expire });

    await expect(
      enforceRedditAccountRateLimit({
        redditAccountId: "ra_1",
        nowMs,
        limit: 2,
        windowSeconds: 60,
      }),
    ).rejects.toMatchObject({
      code: "REDDIT_RATE_LIMIT",
      httpStatus: 429,
      isRetryable: true,
    });
  });

  test("requires redis in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const priorEnv = env.NODE_ENV;
    env.NODE_ENV = "production";
    mockedRedis.getRedis.mockReturnValue(null);

    await expect(
      enforceRedditAccountRateLimit({
        redditAccountId: "ra_1",
        nowMs,
        limit: 2,
        windowSeconds: 60,
      }),
    ).rejects.toMatchObject({ code: "REDIS_NOT_CONFIGURED" });

    env.NODE_ENV = priorEnv;
  });
});
