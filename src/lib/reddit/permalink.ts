const REDDIT_HOST_SUFFIX = ".reddit.com";

function isAllowedRedditHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "reddit.com" || host.endsWith(REDDIT_HOST_SUFFIX);
}

export function normalizeRedditPermalink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith("/")) {
    return `https://www.reddit.com${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (!isAllowedRedditHost(url.hostname)) {
    return null;
  }

  return `https://www.reddit.com${url.pathname}${url.search}`;
}
