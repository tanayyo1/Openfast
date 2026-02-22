/**
 * Localhost smoke checks for app navigation routes and key APIs.
 * Requires the Next.js app to already be running.
 *
 * Usage:
 *   npm run smoke:local
 *
 * Optional env overrides:
 *   SMOKE_BASE_URL=http://localhost:3300
 *   SMOKE_COOKIE="rf_demo_auth=1"
 */

type CheckResult = {
  target: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

type ApiCheck = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  allowRateLimit?: boolean;
};

const baseUrl =
  process.env.SMOKE_BASE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";
const cookie = process.env.SMOKE_COOKIE ?? "rf_demo_auth=1";

const appRoutes = [
  "/dashboard",
  "/onboarding",
  "/projects",
  "/roadmaps",
  "/content",
  "/approvals",
  "/scheduling",
  "/opportunities",
  "/landing-pages",
  "/ads",
  "/analytics",
  "/brand-monitoring",
  "/health",
  "/settings",
  "/tools/post-generator",
  "/tools/subreddit-analyzer",
  "/tools/shadowban-check",
];

const apiChecks: ApiCheck[] = [
  { method: "GET", path: "/api/projects" },
  { method: "GET", path: "/api/workspaces/current" },
  {
    method: "GET",
    path: "/api/tools/subreddit-analyzer?name=r/test",
    allowRateLimit: true,
  },
  {
    method: "POST",
    path: "/api/tools/shadowban-check",
    body: { username: "u/spez" },
    allowRateLimit: true,
  },
  {
    method: "POST",
    path: "/api/tools/post-generate",
    body: {
      topic: "reddit onboarding for saas",
      product: "Openfast",
      audience: "founders",
      tone: "clear",
    },
    allowRateLimit: true,
  },
];

function joinUrl(path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function hasRuntimeErrorMarkers(body: string) {
  return /Application error|Internal Server Error|Unhandled Runtime Error|Something went wrong/i.test(
    body,
  );
}

async function run() {
  const results: CheckResult[] = [];
  const push = (
    target: string,
    status: CheckResult["status"],
    detail: string,
  ) => results.push({ target, status, detail });

  for (const path of appRoutes) {
    const target = `route:${path}`;
    try {
      const response = await fetchWithTimeout(joinUrl(path), {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      const body = await response.text();

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        push(
          target,
          "FAIL",
          `Unexpected redirect (${response.status})${location ? ` -> ${location}` : ""}`,
        );
        continue;
      }

      if (!response.ok) {
        push(target, "FAIL", `HTTP ${response.status}`);
        continue;
      }

      if (hasRuntimeErrorMarkers(body)) {
        push(target, "FAIL", "Runtime error marker detected in HTML response");
        continue;
      }

      push(target, "PASS", `HTTP ${response.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      push(target, "FAIL", message);
    }
  }

  for (const api of apiChecks) {
    const target = `api:${api.method} ${api.path}`;
    try {
      const response = await fetchWithTimeout(joinUrl(api.path), {
        method: api.method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: api.body ? JSON.stringify(api.body) : undefined,
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        push(
          target,
          "FAIL",
          `Unexpected redirect (${response.status})${location ? ` -> ${location}` : ""}`,
        );
        continue;
      }

      if (response.ok) {
        push(target, "PASS", `HTTP ${response.status}`);
        continue;
      }

      if (api.allowRateLimit && response.status === 429) {
        push(target, "WARN", "Rate-limited (HTTP 429)");
        continue;
      }

      const text = await response.text();
      const compact = text.replace(/\s+/g, " ").slice(0, 180);
      push(
        target,
        "FAIL",
        `HTTP ${response.status}${compact ? ` - ${compact}` : ""}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      push(target, "FAIL", message);
    }
  }

  console.log(`Smoke Localhost (${baseUrl})`);
  console.log("=".repeat(32));
  for (const result of results) {
    console.log(`[${result.status}] ${result.target} - ${result.detail}`);
  }

  const failCount = results.filter((result) => result.status === "FAIL").length;
  const warnCount = results.filter((result) => result.status === "WARN").length;
  console.log("");
  console.log(
    `Summary: ${results.length} checks, ${failCount} failed, ${warnCount} warnings.`,
  );

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Smoke local script failed:", err);
  process.exit(1);
});
