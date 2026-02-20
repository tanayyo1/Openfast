import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const APP_PREFIXES = [
  "/dashboard",
  "/projects",
  "/onboarding",
  "/roadmaps",
  "/tasks",
  "/content",
  "/landing-pages",
  "/approvals",
  "/scheduling",
  "/ads",
  "/analytics",
  "/brand-monitoring",
  "/health",
  "/opportunities",
  "/settings",
];

function isAppPath(pathname: string) {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const value = cookie.value?.trim();
    if (!value || value === "deleted") return false;

    if (cookie.name === "sb-access-token" || cookie.name === "sb-refresh-token") {
      return true;
    }

    return cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token");
  });
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

    // Check if origin is an exact match (no substring/regex to prevent bypass)
    const isAllowed = origin && allowedOrigins.includes(origin);

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
  const { response, userId } = await updateSession(request);

  // Add CORS headers to API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins();

    // Exact match only — substring matching is vulnerable to origin spoofing
    const isAllowed = origin && allowedOrigins.includes(origin);

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

  const hasSessionCookie = hasSupabaseSessionCookie(request);
  if (!hasSessionCookie || !userId) {
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
