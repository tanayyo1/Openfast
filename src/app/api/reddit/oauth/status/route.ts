import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getRedditOAuthConfig } from "@/lib/reddit/oauth";
import { getCookie } from "@/lib/server/cookies";

const DEMO_AUTH_COOKIE = "rf_demo_auth";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status =
      code === "WORKSPACE_REQUIRED"
        ? 400
        : code === "SUPABASE_NOT_CONFIGURED"
          ? 503
          : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const oauthConfigured = Boolean(getRedditOAuthConfig());
  const localModeSession = getCookie(req, DEMO_AUTH_COOKIE) === "1";

  // Session is used for workspace auth gate.
  void session;

  return NextResponse.json({
    oauthConfigured,
    localModeSession,
    devConnectAvailable: process.env.NODE_ENV !== "production",
  });
}
