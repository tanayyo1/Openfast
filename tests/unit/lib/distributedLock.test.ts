jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

import { acquireDistributedLock } from "@/lib/locks/distributed";

const mockedRedisModule = jest.requireMock("@/lib/redis") as {
  getRedis: jest.Mock;
};

describe("distributed lock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("acquires and releases lock when redis is available", async () => {
    const set = jest.fn().mockResolvedValue("OK");
    const evalFn = jest.fn().mockResolvedValue(1);
    mockedRedisModule.getRedis.mockReturnValue({ set, eval: evalFn });

    const lock = await acquireDistributedLock({
      key: "publish:scheduled:sp_1",
      ttlMs: 10_000,
    });

    expect(lock.acquired).toBe(true);
    await lock.release();
    expect(set).toHaveBeenCalledWith(
      "lock:publish:scheduled:sp_1",
      expect.any(String),
      "PX",
      10_000,
      "NX",
    );
    expect(evalFn).toHaveBeenCalledTimes(1);
  });

  test("returns not acquired when lock is already held", async () => {
    const set = jest.fn().mockResolvedValue(null);
    mockedRedisModule.getRedis.mockReturnValue({ set, eval: jest.fn() });

    const lock = await acquireDistributedLock({
      key: "publish:scheduled:sp_1",
      ttlMs: 10_000,
    });

    expect(lock.acquired).toBe(false);
  });

  test("falls back to no-op lock when redis is unavailable in non-production", async () => {
    const env = process.env.NODE_ENV;
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = "test";
    mockedRedisModule.getRedis.mockReturnValue(null);

    const lock = await acquireDistributedLock({
      key: "publish:scheduled:sp_1",
      ttlMs: 10_000,
    });

    expect(lock.acquired).toBe(true);
    await expect(lock.release()).resolves.toBeUndefined();
    mutableEnv.NODE_ENV = env;
  });
});
