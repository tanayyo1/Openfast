function pickString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

export function normalizePermalink(permalink: string): string {
  if (permalink.startsWith("http://") || permalink.startsWith("https://")) {
    return permalink;
  }
  const normalized = permalink.startsWith("/") ? permalink : `/${permalink}`;
  return `https://www.reddit.com${normalized}`;
}

export function parseSubmitResponse(payload: unknown): {
  redditFullname: string;
  redditId: string;
  permalink: string;
  url: string | null;
} {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const json =
    root.json && typeof root.json === "object"
      ? (root.json as Record<string, unknown>)
      : {};
  const data =
    json.data && typeof json.data === "object"
      ? (json.data as Record<string, unknown>)
      : {};

  const redditFullname = pickString(data, ["name", "fullname"]) ?? "t3_unknown";
  const redditId =
    pickString(data, ["id"]) ?? redditFullname.replace(/^t\d_/, "");
  const permalink = normalizePermalink(
    pickString(data, ["permalink", "url"]) ?? `/comments/${redditId}`,
  );
  const url = pickString(data, ["url"]);

  return { redditFullname, redditId, permalink, url };
}

export function parseMetricsResponse(payload: unknown): {
  score: number;
  upvotes: number;
  downvotes: number;
  upvoteRatio: number | null;
  numComments: number;
  isRemoved: boolean;
  removalReason: string | null;
  isLocked: boolean;
  isStickied: boolean;
  rawData: Record<string, unknown>;
} {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const listing =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : {};
  const children = Array.isArray(listing.children) ? listing.children : [];
  const child =
    children[0] && typeof children[0] === "object"
      ? (children[0] as Record<string, unknown>)
      : {};
  const data =
    child.data && typeof child.data === "object"
      ? (child.data as Record<string, unknown>)
      : {};

  const score = pickNumber(data, ["score"]);
  const upvotes = pickNumber(data, ["ups", "upvotes"], score >= 0 ? score : 0);
  const downvotes = pickNumber(data, ["downs", "downvotes"], 0);
  const upvoteRatioRaw = data.upvote_ratio;
  const upvoteRatio =
    typeof upvoteRatioRaw === "number" && Number.isFinite(upvoteRatioRaw)
      ? upvoteRatioRaw
      : null;
  const numComments = pickNumber(data, ["num_comments", "comments"]);
  const removalReason =
    pickString(data, ["removed_by_category", "ban_note", "mod_reason_title"]) ??
    null;
  const isRemoved = removalReason !== null;
  const isLocked = Boolean(data.locked);
  const isStickied = Boolean(data.stickied);

  return {
    score,
    upvotes,
    downvotes,
    upvoteRatio,
    numComments,
    isRemoved,
    removalReason,
    isLocked,
    isStickied,
    rawData: data,
  };
}
