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

// Allowed origins for CORS
function getAllowedOrigins() {
  return [
    process.env.APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean) as string[];
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins();

    // Check if origin is allowed
    const isAllowed =
      origin &&
      allowedOrigins.some(
        (allowed) =>
          origin === allowed ||
          origin.includes(
            allowed.replace("https://", "").replace("http://", ""),
          ),
      );

    if (isAllowed) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET,DELETE,PATCH,POST,PUT,OPTIONS",
          "Access-Control-Allow-Headers":
            "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          Vary: "Origin",
        },
      });
    }
  }

  // Update Supabase session and get response
  const response = await updateSession(request);

  // Add CORS headers to API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins();

    const isAllowed =
      origin &&
      allowedOrigins.some(
        (allowed) =>
          origin === allowed ||
          origin.includes(
            allowed.replace("https://", "").replace("http://", ""),
          ),
      );

    if (isAllowed && origin) {
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
    }
  }

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

  // Extract project ref from various URL formats including custom domains
  // - https://xxx.supabase.co (production)
  // - http://localhost:54321 (local)
  // - https://xxx.supabase.red (preview)
  // - https://custom-domain.com (custom domain)
  let projectRef: string | undefined;

  if (
    supabaseUrl.includes("supabase.co") ||
    supabaseUrl.includes("supabase.red")
  ) {
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\./);
    projectRef = match?.[1];
  } else if (supabaseUrl.includes(":54321")) {
    // Local Supabase
    projectRef = "local";
  }

  // Try project-specific cookie first, then fallback to generic
  let authCookie = null;
  if (projectRef) {
    authCookie = request.cookies.get(`sb-${projectRef}-auth-token`);
  }
  if (!authCookie) {
    authCookie =
      request.cookies.get("sb-access-token") ||
      request.cookies.get("sb-refresh-token");
  }

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
