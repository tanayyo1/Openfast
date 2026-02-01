import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getCookie } from "@/lib/server/cookies";
import {
  encryptRedditToken,
  exchangeCodeForTokens,
  fetchRedditMe,
  getRedditOAuthConfig,
} from "@/lib/reddit/oauth";
import { TokenCryptoError } from "@/lib/security/tokenCrypto";

const OAUTH_STATE_COOKIE = "rf_reddit_oauth_state";
const OAUTH_NEXT_COOKIE = "rf_reddit_oauth_next";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const cfg = getRedditOAuthConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error: "Reddit OAuth is not configured",
        code: "REDDIT_OAUTH_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        error: "Reddit OAuth failed",
        code: "REDDIT_OAUTH_ERROR",
        details: { error },
      },
      { status: 400 },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing OAuth params", code: "OAUTH_PARAMS_MISSING" },
      { status: 400 },
    );
  }

  const expectedState = getCookie(req, OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return NextResponse.json(
      { error: "Invalid OAuth state", code: "OAUTH_STATE_MISMATCH" },
      { status: 400 },
    );
  }

  // Exchange code for tokens
  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForTokens({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
      code,
      userAgent: cfg.userAgent,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "TOKEN_EXCHANGE_FAILED";
    return NextResponse.json(
      {
        error: "Token exchange failed",
        code: "TOKEN_EXCHANGE_FAILED",
        details: { message },
      },
      { status: 502 },
    );
  }

  // Fetch user identity
  let me;
  try {
    me = await fetchRedditMe({
      accessToken: tokenResponse.access_token,
      userAgent: cfg.userAgent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ME_FETCH_FAILED";
    return NextResponse.json(
      {
        error: "Failed to fetch account identity",
        code: "ME_FETCH_FAILED",
        details: { message },
      },
      { status: 502 },
    );
  }

  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
  const scopes = tokenResponse.scope.split(" ").filter(Boolean);

  // Store encrypted tokens at rest.
  let accessTokenEncrypted: string;
  let refreshTokenEncrypted: string;
  try {
    accessTokenEncrypted = encryptRedditToken(tokenResponse.access_token);
    refreshTokenEncrypted = encryptRedditToken(
      tokenResponse.refresh_token ?? "",
    );
  } catch (err) {
    const code =
      err instanceof TokenCryptoError ? err.code : "TOKEN_ENCRYPTION_FAILED";
    return NextResponse.json(
      { error: "Token encryption failed", code },
      { status: 500 },
    );
  }

  const now = new Date();
  const created = await prisma.redditAccount.upsert({
    where: {
      workspaceId_redditUsername: {
        workspaceId: session.workspaceId,
        redditUsername: me.name,
      },
    },
    update: {
      workspaceId: session.workspaceId,
      redditUserId: me.id,
      accessToken: accessTokenEncrypted,
      refreshToken: refreshTokenEncrypted,
      tokenExpiry: expiresAt,
      scopes,
      linkKarma: me.link_karma ?? 0,
      commentKarma: me.comment_karma ?? 0,
      accountAge:
        typeof me.created_utc === "number"
          ? Math.max(
              0,
              Math.floor((Date.now() / 1000 - me.created_utc) / 86400),
            )
          : 0,
      lastSyncAt: now,
      isActive: true,
    },
    create: {
      workspaceId: session.workspaceId,
      redditUsername: me.name,
      redditUserId: me.id,
      accessToken: accessTokenEncrypted,
      refreshToken: refreshTokenEncrypted,
      tokenExpiry: expiresAt,
      scopes,
      linkKarma: me.link_karma ?? 0,
      commentKarma: me.comment_karma ?? 0,
      accountAge:
        typeof me.created_utc === "number"
          ? Math.max(
              0,
              Math.floor((Date.now() / 1000 - me.created_utc) / 86400),
            )
          : 0,
      lastSyncAt: now,
      isActive: true,
    },
    select: { id: true, redditUsername: true },
  });

  const next =
    getCookie(req, OAUTH_NEXT_COOKIE) ?? "/onboarding/connect-reddit";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/onboarding/connect-reddit";

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(OAUTH_NEXT_COOKIE);

  // Not returning tokens.
  void created;

  return res;
}
