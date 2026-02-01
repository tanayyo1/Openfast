import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import {
  buildAuthorizeUrl,
  generateOAuthState,
  getRedditOAuthConfig,
} from "@/lib/reddit/oauth";

const OAUTH_STATE_COOKIE = "rf_reddit_oauth_state";

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
  const next = searchParams.get("next") ?? "/onboarding/connect-reddit";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/onboarding/connect-reddit";

  const state = generateOAuthState();
  const scope = ["identity", "read", "submit", "history"].join(" ");
  const authorizeUrl = buildAuthorizeUrl({
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    state,
    scope,
  });

  const res = NextResponse.redirect(authorizeUrl);

  // Bind state to the browser session to prevent CSRF.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  // Store a safe redirect target after OAuth completes.
  res.cookies.set("rf_reddit_oauth_next", safeNext, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  // Session is read to enforce auth; workspaceId is enforced by requireWorkspaceSession.
  void session;

  return res;
}
