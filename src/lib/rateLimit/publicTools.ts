import type { Redis } from "ioredis";
import { getRedis } from "@/lib/redis";

const memoryCounters = new Map<string, { count: number; expiresAt: number }>();

function nowMs() {
  return Date.now();
}

function cleanupMemoryCounter(key: string) {
  const entry = memoryCounters.get(key);
  if (entry && entry.expiresAt <= nowMs()) {
    memoryCounters.delete(key);
  }
}

async function bumpRedisCounter(redis: Redis, key: string, ttlSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

function bumpMemoryCounter(key: string, ttlSeconds: number) {
  cleanupMemoryCounter(key);
  const existing = memoryCounters.get(key);
  if (!existing) {
    memoryCounters.set(key, {
      count: 1,
      expiresAt: nowMs() + ttlSeconds * 1000,
    });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

function extractIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function enforcePublicToolRateLimit(opts: {
  req: Request;
  tool: "post-generate" | "subreddit-analyzer" | "shadowban-check";
  userId?: string | null;
}) {
  const ttlSeconds = 60;
  const perIpLimit = 20;
  const perUserLimit = 60;
  const ip = extractIp(opts.req);
  const subject = opts.userId ? `user:${opts.userId}` : `ip:${ip}`;
  const key = `rl:tools:${opts.tool}:${subject}`;

  const redis = getRedis();
  const count = redis
    ? await bumpRedisCounter(redis, key, ttlSeconds)
    : bumpMemoryCounter(key, ttlSeconds);

  const limit = opts.userId ? perUserLimit : perIpLimit;
  const remaining = Math.max(0, limit - count);
  if (count > limit) {
    return {
      allowed: false as const,
      limit,
      remaining: 0,
      resetAfterSeconds: ttlSeconds,
    };
  }

  return {
    allowed: true as const,
    limit,
    remaining,
    resetAfterSeconds: ttlSeconds,
  };
}
