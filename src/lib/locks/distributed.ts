import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";

type AcquireLockOptions = {
  key: string;
  ttlMs: number;
};

type DistributedLock = {
  acquired: boolean;
  release: () => Promise<void>;
};

export class LockBackendUnavailableError extends Error {
  code = "LOCK_BACKEND_UNAVAILABLE";
  isRetryable = true;

  constructor() {
    super("Distributed lock backend is unavailable");
  }
}

function lockKey(key: string) {
  return `lock:${key}`;
}

export async function acquireDistributedLock(
  opts: AcquireLockOptions,
): Promise<DistributedLock> {
  const redis = getRedis();
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new LockBackendUnavailableError();
    }
    return { acquired: true, release: async () => undefined };
  }

  const token = randomUUID();
  const acquired = await redis.set(
    lockKey(opts.key),
    token,
    "PX",
    opts.ttlMs,
    "NX",
  );
  if (acquired !== "OK") {
    return { acquired: false, release: async () => undefined };
  }

  const release = async () => {
    const script = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
    try {
      await redis.eval(script, 1, lockKey(opts.key), token);
    } catch {
      // Best effort unlock.
    }
  };

  return { acquired: true, release };
}
