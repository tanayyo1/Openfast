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

  // Check for Supabase auth session
  const authCookie = request.cookies.get("sb-access-token");
  const refreshCookie = request.cookies.get("sb-refresh-token");

  if (!authCookie && !refreshCookie) {
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
