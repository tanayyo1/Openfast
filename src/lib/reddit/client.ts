import { getRedis } from "@/lib/redis";
import { getRedditOAuthConfig } from "@/lib/reddit/oauth";
import {
  RedditApiError,
  classifyRedditResponseError,
} from "@/lib/reddit/errors";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_ACCOUNT_LIMIT_PER_WINDOW = 60;

function windowKey(nowMs: number, windowSeconds: number) {
  return Math.floor(nowMs / 1000 / windowSeconds).toString();
}

async function enforceAccountRateLimit(opts: {
  redditAccountId: string;
  nowMs?: number;
  limit?: number;
  windowSeconds?: number;
}) {
  const nowMs = opts.nowMs ?? Date.now();
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const limit = opts.limit ?? DEFAULT_ACCOUNT_LIMIT_PER_WINDOW;

  const redis = getRedis();
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new RedditApiError({
        code: "REDIS_NOT_CONFIGURED",
        message: "Redis is required for rate limiting in production",
        httpStatus: 500,
        isRetryable: false,
      });
    }
    return { remaining: null as number | null };
  }

  const k = `rl:reddit:${opts.redditAccountId}:${windowKey(nowMs, windowSeconds)}`;
  const count = await redis.incr(k);
  if (count === 1) {
    // Ensure the key expires even if the process crashes.
    await redis.expire(k, windowSeconds + 1);
  }

  const remaining = Math.max(0, limit - count);
  if (count > limit) {
    const resetAtMs =
      (Math.floor(nowMs / 1000 / windowSeconds) + 1) * windowSeconds * 1000;
    const retryAfterMs = Math.max(0, resetAtMs - nowMs);
    throw new RedditApiError({
      code: "REDDIT_RATE_LIMIT",
      message: "Reddit rate limit exceeded (local enforcement)",
      httpStatus: 429,
      isRetryable: true,
      retryAfterMs,
    });
  }

  return { remaining };
}

export async function enforceRedditAccountRateLimit(opts: {
  redditAccountId: string;
  nowMs?: number;
  limit?: number;
  windowSeconds?: number;
}) {
  return enforceAccountRateLimit(opts);
}

export async function redditFetch<T>(opts: {
  redditAccountId: string;
  accessToken: string;
  path: string;
  method?: HttpMethod;
  query?: Record<string, string>;
  body?: unknown;
}) {
  const cfg = getRedditOAuthConfig();
  const userAgent = cfg?.userAgent ?? "ReditFast/0.1";

  // Enforce per-account limit before we even hit Reddit.
  const rl = await enforceAccountRateLimit({
    redditAccountId: opts.redditAccountId,
  });

  const url = new URL(`https://oauth.reddit.com${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "User-Agent": userAgent,
      ...(opts.body ? { "Content-Type": "application/json" } : null),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    // Never include tokens in thrown errors.
    throw classifyRedditResponseError(res);
  }

  const data = (await res.json()) as T;
  return { data, rateLimit: { remaining: rl.remaining } };
}
