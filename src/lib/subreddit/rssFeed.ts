/**
 * RSS Feed Parser for Reddit Subreddits
 *
 * Reddit exposes free RSS feeds at /r/{subreddit}/new.rss
 * No auth, no API key, no rate limits worth worrying about.
 * Returns ~25 most recent posts as XML (Atom format).
 *
 * We parse the XML into a clean array of posts.
 * This is how we monitor subreddits without Reddit API access.
 */

export type RssPost = {
  /** Reddit post ID e.g. "t3_abc123" */
  id: string;
  /** Post title */
  title: string;
  /** Full Reddit URL to the post */
  url: string;
  /** Author username (no u/ prefix) */
  author: string;
  /** HTML snippet from the RSS content (first ~500 chars, stripped) */
  snippet: string;
  /** When the post was published on Reddit */
  publishedAt: Date;
};

/**
 * Strips HTML tags from a string and truncates to maxLen.
 * RSS content comes as HTML — we just want plain text for AI.
 */
function stripHtml(html: string, maxLen = 500): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Extracts text between XML tags. Simple regex parser —
 * no need for a full XML library for Reddit's predictable Atom format.
 */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? "";
}

function extractAttribute(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/?>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? "";
}

/**
 * Fetch and parse an RSS feed for a subreddit.
 * Returns an array of posts sorted newest first.
 *
 * Uses the Cloudflare proxy if configured (same as other Reddit fetches),
 * falls back to direct fetch for local dev.
 */
export async function fetchSubredditRss(subreddit: string): Promise<RssPost[]> {
  const name = subreddit.toLowerCase().replace(/^r\//, "");

  // Reddit RSS feeds don't need the proxy (they're less likely to be blocked),
  // but we use it for consistency and reliability on Vercel.
  const { fetchRedditJson } = await import("@/lib/reddit/proxyFetch");

  // Note: we're using fetchRedditJson but the response is XML, not JSON.
  // The proxy just forwards whatever Reddit returns.
  // We need to add .rss support to the proxy allowed paths first,
  // so for now we fetch directly. RSS feeds are less blocked than .json.
  const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/new.rss`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        process.env.REDDIT_USER_AGENT ??
        "Mozilla/5.0 (compatible; Openfast/0.1; +https://openfast-nine.vercel.app)",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS_FETCH_FAILED:${res.status}`);
  }

  const xml = await res.text();

  // Reddit RSS uses Atom format. Each post is an <entry> element.
  const entries = xml.split("<entry>").slice(1); // skip the feed header

  const posts: RssPost[] = [];
  for (const entry of entries) {
    const id = extractTag(entry, "id");
    const title = extractTag(entry, "title");
    const link = extractAttribute(entry, "link", "href");
    const author = extractTag(entry, "name"); // inside <author><name>
    const content = extractTag(entry, "content");
    const updated = extractTag(entry, "updated");

    if (!id || !title) continue;

    // Reddit post IDs in RSS look like full URLs — extract the t3_ part
    const redditId = id.includes("/comments/")
      ? `t3_${id.split("/comments/")[1]?.split("/")[0] ?? ""}`
      : id;

    posts.push({
      id: redditId,
      title: stripHtml(title),
      url: link || id,
      author: author.replace(/^\/u\//, ""),
      snippet: stripHtml(content),
      publishedAt: updated ? new Date(updated) : new Date(),
    });
  }

  return posts;
}
