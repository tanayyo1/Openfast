import { getRedis } from "@/lib/redis";

export type IngestedSubredditData = {
  name: string;
  title: string;
  description: string;
  subscribers: number;
  activeUsers: number;
  avgPostsPerDay: number;
  avgCommentsPerPost: number;
  rules: string[];
  nsfw: boolean;
  isRestricted: boolean;
  isQuarantined: boolean;
};

type FetchSource = "reddit" | "fallback";

type FetchResult = {
  data: IngestedSubredditData;
  source: FetchSource;
  cacheHit: boolean;
};

type CachePayload = {
  version: 1;
  cachedAt: string;
  source: FetchSource;
  data: IngestedSubredditData;
};

const CACHE_KEY_PREFIX = "cache:subreddit:intel:v1:";
const DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60;

type KnownSubredditDefaults = Pick<
  IngestedSubredditData,
  "avgPostsPerDay" | "avgCommentsPerPost" | "rules"
>;

const KNOWN_DEFAULTS: Record<string, KnownSubredditDefaults> = {
  startups: {
    avgPostsPerDay: 88,
    avgCommentsPerPost: 16,
    rules: [
      "No blatant self-promo",
      "Share lessons and context",
      "Use correct post flair",
    ],
  },
  entrepreneur: {
    avgPostsPerDay: 120,
    avgCommentsPerPost: 11,
    rules: [
      "No affiliate links",
      "Promotional posts must add value",
      "Low-effort posts removed",
    ],
  },
  smallbusiness: {
    avgPostsPerDay: 73,
    avgCommentsPerPost: 8,
    rules: [
      "No direct advertising",
      "Be specific and helpful",
      "No misleading claims",
    ],
  },
  saas: {
    avgPostsPerDay: 36,
    avgCommentsPerPost: 9,
    rules: [
      "No links in comments when promoting",
      "Must provide context for case studies",
    ],
  },
  marketing: {
    avgPostsPerDay: 68,
    avgCommentsPerPost: 10,
    rules: ["No spam", "No duplicate posts", "No low-value self promotion"],
  },
};

const memoryCache = new Map<string, { expiresAtMs: number; payload: string }>();

function normalizeSubredditName(input: string) {
  return input.trim().replace(/^r\//i, "").toLowerCase();
}

function cacheKey(subredditName: string) {
  return `${CACHE_KEY_PREFIX}${subredditName}`;
}

function toInteger(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return fallback;
}

function toStringValue(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function getCacheTtlSeconds() {
  const raw = Number(process.env.SUBREDDIT_RULES_CACHE_TTL_SECONDS);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_CACHE_TTL_SECONDS;
}

function estimateAvgPostsPerDay(activeUsers: number, subscribers: number) {
  const active = Math.max(activeUsers, 1);
  const subscribersScale = Math.log10(Math.max(subscribers, 10));
  const estimated = active / 60 + subscribersScale * 6;
  return Number(Math.max(4, Math.min(300, estimated)).toFixed(1));
}

function estimateAvgCommentsPerPost(activeUsers: number, subscribers: number) {
  const engagement = activeUsers / Math.max(subscribers, 1);
  const estimated = 3 + engagement * 4000;
  return Number(Math.max(2, Math.min(120, estimated)).toFixed(1));
}

function normalizeRules(rules: string[]) {
  const deduped = new Set<string>();
  for (const rule of rules) {
    const value = rule.trim();
    if (!value) continue;
    deduped.add(value);
  }
  return Array.from(deduped);
}

function fallbackSubredditData(subredditName: string): IngestedSubredditData {
  const normalized = normalizeSubredditName(subredditName);
  const defaults = KNOWN_DEFAULTS[normalized];

  if (defaults) {
    return {
      name: normalized,
      title: normalized,
      description: `Community discussions in r/${normalized}`,
      subscribers: 20_000,
      activeUsers: 120,
      avgPostsPerDay: defaults.avgPostsPerDay,
      avgCommentsPerPost: defaults.avgCommentsPerPost,
      rules: defaults.rules,
      nsfw: false,
      isRestricted: false,
      isQuarantined: false,
    };
  }

  return {
    name: normalized,
    title: normalized,
    description: `Community discussions in r/${normalized}`,
    subscribers: 20_000,
    activeUsers: 120,
    avgPostsPerDay: 14,
    avgCommentsPerPost: 4,
    rules: ["No spam", "Be respectful", "Self-promo only if relevant"],
    nsfw: false,
    isRestricted: false,
    isQuarantined: false,
  };
}

function readMemoryCache(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeMemoryCache(key: string, value: string, ttlSeconds: number) {
  memoryCache.set(key, {
    payload: value,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  });
}

async function readCache(normalizedName: string): Promise<FetchResult | null> {
  const key = cacheKey(normalizedName);
  const redis = getRedis();

  const raw = redis ? await redis.get(key) : readMemoryCache(key);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as CachePayload;
    if (payload.version !== 1 || !payload.data) return null;
    return {
      data: payload.data,
      source: payload.source,
      cacheHit: true,
    };
  } catch {
    return null;
  }
}

async function writeCache(
  normalizedName: string,
  source: FetchSource,
  data: IngestedSubredditData,
) {
  const key = cacheKey(normalizedName);
  const ttlSeconds = getCacheTtlSeconds();
  const payload: CachePayload = {
    version: 1,
    cachedAt: new Date().toISOString(),
    source,
    data,
  };
  const serialized = JSON.stringify(payload);

  const redis = getRedis();
  if (redis) {
    await redis.setex(key, ttlSeconds, serialized);
    return;
  }
  writeMemoryCache(key, serialized, ttlSeconds);
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1",
    },
  });
  if (!res.ok) {
    throw new Error(`REDDIT_FETCH_FAILED:${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

function formatRule(rule: unknown): string | null {
  if (!rule || typeof rule !== "object") return null;
  const shortName = "short_name" in rule ? rule.short_name : undefined;
  const description = "description" in rule ? rule.description : undefined;
  const shortNameText =
    typeof shortName === "string" && shortName.trim().length > 0
      ? shortName.trim()
      : null;
  const descriptionText =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;

  if (!shortNameText && !descriptionText) return null;
  if (!descriptionText) return shortNameText;
  if (!shortNameText) return descriptionText;
  return `${shortNameText}: ${descriptionText}`;
}

async function fetchFromReddit(
  normalizedName: string,
): Promise<IngestedSubredditData> {
  const aboutJson = (await fetchJson(
    `https://www.reddit.com/r/${encodeURIComponent(normalizedName)}/about.json`,
  )) as {
    data?: {
      display_name?: string;
      title?: string;
      public_description?: string;
      subscribers?: number;
      active_user_count?: number;
      over18?: boolean;
      subreddit_type?: string;
      quarantine?: boolean;
    };
  };

  const rulesJson = (await fetchJson(
    `https://www.reddit.com/r/${encodeURIComponent(
      normalizedName,
    )}/about/rules.json`,
  )) as {
    rules?: unknown[];
  };

  const about = aboutJson.data ?? {};
  const displayName = toStringValue(about.display_name, normalizedName);
  const title = toStringValue(about.title, displayName);
  const description = toStringValue(
    about.public_description,
    `Community discussions in r/${displayName}`,
  );
  const subscribers = toInteger(about.subscribers, 0);
  const activeUsers = toInteger(about.active_user_count, 0);

  const defaults = KNOWN_DEFAULTS[normalizedName];
  const estimatedAvgPostsPerDay = defaults
    ? defaults.avgPostsPerDay
    : estimateAvgPostsPerDay(activeUsers, subscribers);
  const estimatedAvgCommentsPerPost = defaults
    ? defaults.avgCommentsPerPost
    : estimateAvgCommentsPerPost(activeUsers, subscribers);

  const rulesFromApi = Array.isArray(rulesJson.rules)
    ? rulesJson.rules.map(formatRule).filter((value): value is string => !!value)
    : [];
  const rules = normalizeRules(
    rulesFromApi.length > 0
      ? rulesFromApi
      : defaults?.rules ?? fallbackSubredditData(normalizedName).rules,
  );

  return {
    name: displayName.toLowerCase(),
    title,
    description,
    subscribers,
    activeUsers,
    avgPostsPerDay: estimatedAvgPostsPerDay,
    avgCommentsPerPost: estimatedAvgCommentsPerPost,
    rules,
    nsfw: Boolean(about.over18),
    isRestricted: about.subreddit_type === "restricted",
    isQuarantined: Boolean(about.quarantine),
  };
}

export async function fetchSubredditDataWithCache(
  subredditName: string,
  opts?: { forceRefresh?: boolean },
): Promise<FetchResult> {
  const normalizedName = normalizeSubredditName(subredditName);
  if (!normalizedName) {
    throw new Error("SUBREDDIT_NAME_REQUIRED");
  }

  if (!opts?.forceRefresh) {
    const cached = await readCache(normalizedName);
    if (cached) return cached;
  }

  try {
    const fetched = await fetchFromReddit(normalizedName);
    await writeCache(normalizedName, "reddit", fetched);
    return {
      data: fetched,
      source: "reddit",
      cacheHit: false,
    };
  } catch {
    const fallback = fallbackSubredditData(normalizedName);
    await writeCache(normalizedName, "fallback", fallback);
    return {
      data: fallback,
      source: "fallback",
      cacheHit: false,
    };
  }
}
