import Redis from "ioredis";

let redisSingleton: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisSingleton) {
    // Keep config conservative for serverless/dev parity.
    redisSingleton = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return redisSingleton;
}
