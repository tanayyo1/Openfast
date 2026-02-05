import type Redis from "ioredis";
import { getRedis } from "@/lib/redis";

export function requireRedis(): Redis {
  const redis = getRedis();
  if (!redis) {
    throw new Error("REDIS_NOT_CONFIGURED");
  }
  return redis;
}
