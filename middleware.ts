import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const APP_PREFIXES = [
  "/dashboard",
  "/projects",
  "/onboarding",
  "/roadmaps",
  "/tasks",
  "/content",
  "/approvals",
  "/scheduling",
  "/analytics",
  "/health",
  "/opportunities",
  "/settings",
];

function isAppPath(pathname: string) {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Update Supabase session and get response
  const response = await updateSession(request);

  if (!isAppPath(pathname)) {
    return response;
  }

  // Demo auth bypass for development
  const demoAuth = request.cookies.get("rf_demo_auth")?.value;
  if (process.env.NODE_ENV !== "production" && demoAuth === "1") {
    return response;
  }

  // Check for Supabase auth session (support all URL formats)
  // Cookie formats: sb-[project-ref]-auth-token OR sb-access-token
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Extract project ref from various URL formats:
  // - https://xxx.supabase.co (production)
  // - http://localhost:54321 (local)
  // - https://xxx.supabase.red (preview)
  const projectRefMatch = supabaseUrl.match(
    /(?:https?:\/\/)?([^.]+)(?:\.supabase\.(?:co|red)|:\d+)/,
  );
  const projectRef = projectRefMatch?.[1];

  // Try project-specific cookie first, then fallback to generic
  const authCookie = projectRef
    ? request.cookies.get(`sb-${projectRef}-auth-token`) ||
      request.cookies.get("sb-access-token")
    : request.cookies.get("sb-access-token");

  if (!authCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
