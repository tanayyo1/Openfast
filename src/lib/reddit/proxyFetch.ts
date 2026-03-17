/**
 * Fetch a Reddit .json endpoint, routing through the Cloudflare Worker proxy
 * when configured. Falls back to direct fetch if proxy is not set up.
 *
 * Why: Reddit blocks requests from Vercel's data center IPs (403).
 * The Cloudflare Worker runs on edge IPs that Reddit doesn't block.
 */
export async function fetchRedditJson(
  path: string,
  opts?: { signal?: AbortSignal },
): Promise<Response> {
  const proxyUrl = process.env.REDDIT_PROXY_URL;
  const proxyKey = process.env.REDDIT_PROXY_KEY;
  const userAgent =
    process.env.REDDIT_USER_AGENT ??
    "Mozilla/5.0 (compatible; Openfast/0.1; +https://openfast-nine.vercel.app)";

  // Route through Cloudflare proxy when configured
  if (proxyUrl && proxyKey) {
    return fetch(`${proxyUrl}${path}`, {
      signal: opts?.signal,
      cache: "no-store",
      headers: {
        "x-proxy-key": proxyKey,
      },
    });
  }

  // Fallback: direct fetch (works locally, blocked on Vercel)
  return fetch(`https://www.reddit.com${path}`, {
    signal: opts?.signal,
    cache: "no-store",
    headers: {
      "User-Agent": userAgent,
    },
  });
}
