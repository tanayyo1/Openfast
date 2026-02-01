import { randomBytes } from "crypto";
import { encryptToken } from "@/lib/security/tokenCrypto";

export type RedditOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userAgent: string;
};

export function getRedditOAuthConfig(): RedditOAuthConfig | null {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const redirectUri = process.env.REDDIT_REDIRECT_URI;
  const userAgent = process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1";

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri, userAgent };
}

export function generateOAuthState() {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}) {
  const url = new URL("https://www.reddit.com/api/v1/authorize");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("duration", "permanent");
  url.searchParams.set("scope", opts.scope);
  return url.toString();
}

export async function exchangeCodeForTokens(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  userAgent: string;
}) {
  const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString(
    "base64",
  );

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", opts.code);
  body.set("redirect_uri", opts.redirectUri);

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": opts.userAgent,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `TOKEN_EXCHANGE_FAILED:${res.status}:${text.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  return json;
}

export async function fetchRedditMe(opts: {
  accessToken: string;
  userAgent: string;
}) {
  const res = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "User-Agent": opts.userAgent,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ME_FETCH_FAILED:${res.status}:${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    name: string;
    id: string;
    link_karma?: number;
    comment_karma?: number;
    created_utc?: number;
  };
  return json;
}

export function encryptRedditToken(plaintext: string) {
  // Wrapper to make intent explicit at call sites.
  return encryptToken(plaintext);
}
