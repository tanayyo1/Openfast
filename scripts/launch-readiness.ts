/**
 * Launch readiness checks for local/staging/production environments.
 * Usage: npx tsx scripts/launch-readiness.ts
 */

import { execSync } from "child_process";
import { loadEnvConfig } from "@next/env";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { getTokenKeyring } from "@/lib/security/tokenCrypto";

type CheckStatus = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  id: string;
  status: CheckStatus;
  detail: string;
};

loadEnvConfig(process.cwd());

function env(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function validateRedditRedirectUri(raw: string) {
  try {
    const parsed = new URL(raw);
    if (parsed.pathname !== "/api/reddit/oauth/callback") {
      return {
        ok: false,
        detail: "REDDIT_REDIRECT_URI must use /api/reddit/oauth/callback path",
      };
    }
    return { ok: true, detail: "REDDIT_REDIRECT_URI route format is correct" };
  } catch {
    return {
      ok: false,
      detail: "REDDIT_REDIRECT_URI must be a valid absolute URL",
    };
  }
}

async function checkSupabaseReachability(url: string, anonKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(new URL("/auth/v1/settings", url), {
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const checks: CheckResult[] = [];
  const push = (id: string, status: CheckStatus, detail: string) =>
    checks.push({ id, status, detail });

  const required = [
    "APP_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_REDIRECT_URI",
  ] as const;

  for (const name of required) {
    if (env(name)) {
      push(`env:${name}`, "PASS", `${name} is set`);
    } else {
      push(`env:${name}`, "FAIL", `${name} is missing`);
    }
  }

  if (env("OPENAI_API_KEY")) {
    push("env:OPENAI_API_KEY", "PASS", "OPENAI_API_KEY is set");
  } else {
    push(
      "env:OPENAI_API_KEY",
      "WARN",
      "OPENAI_API_KEY is missing (AI quality/features degrade to fallback behavior)",
    );
  }

  if (
    env("POLAR_ACCESS_TOKEN") &&
    env("POLAR_WEBHOOK_SECRET") &&
    env("POLAR_PRODUCT_PRO") &&
    env("POLAR_PRODUCT_ENTERPRISE")
  ) {
    push("env:POLAR", "PASS", "Polar billing variables are set");
  } else {
    push(
      "env:POLAR",
      "WARN",
      "Polar billing variables are incomplete (checkout/webhooks may fail)",
    );
  }

  const redirectUri = env("REDDIT_REDIRECT_URI");
  if (!redirectUri) {
    push("reddit:redirect", "FAIL", "REDDIT_REDIRECT_URI is missing");
  } else {
    const redirectCheck = validateRedditRedirectUri(redirectUri);
    push(
      "reddit:redirect",
      redirectCheck.ok ? "PASS" : "FAIL",
      redirectCheck.detail,
    );
  }

  const keyring = getTokenKeyring();
  if (Object.keys(keyring).length > 0) {
    push(
      "security:token-keys",
      "PASS",
      "TOKEN_ENCRYPTION_KEYS has valid entries",
    );
  } else {
    push(
      "security:token-keys",
      "FAIL",
      "TOKEN_ENCRYPTION_KEYS is missing/invalid (Reddit token encryption will fail)",
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    push("service:db", "PASS", "Database is reachable");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Database check failed";
    push("service:db", "FAIL", message.slice(0, 180));
  }

  const redisUrl = env("REDIS_URL");
  if (!redisUrl) {
    push("service:redis", "FAIL", "REDIS_URL is missing");
  } else {
    let redis: Redis | null = null;
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 3000,
      });
      await redis.connect();
      const pong = await redis.ping();
      if (pong === "PONG") {
        push("service:redis", "PASS", "Redis is reachable");
      } else {
        push(
          "service:redis",
          "FAIL",
          `Unexpected Redis ping response: ${pong}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Redis check failed";
      push("service:redis", "FAIL", message.slice(0, 180));
    } finally {
      if (redis) {
        await redis.quit().catch(() => redis?.disconnect());
      }
    }
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    push(
      "service:supabase",
      "FAIL",
      "Supabase URL/anon key missing, cannot test connectivity",
    );
  } else {
    try {
      const check = await checkSupabaseReachability(supabaseUrl, supabaseAnon);
      if (check.ok) {
        push("service:supabase", "PASS", "Supabase auth endpoint is reachable");
      } else {
        push(
          "service:supabase",
          "FAIL",
          `Supabase auth endpoint returned status ${check.status}`,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Supabase check failed";
      if (
        message.toLowerCase().includes("fetch failed") ||
        message.toLowerCase().includes("failed to fetch")
      ) {
        push(
          "service:supabase",
          "FAIL",
          "Unable to reach Supabase host. Verify NEXT_PUBLIC_SUPABASE_URL DNS/network.",
        );
      } else {
        push("service:supabase", "FAIL", message.slice(0, 180));
      }
    }
  }

  try {
    execSync("npx prisma migrate status", { stdio: "pipe", encoding: "utf8" });
    push("migrations", "PASS", "No pending Prisma migrations");
  } catch (err) {
    const output = String(
      (err as { stdout?: string; stderr?: string }).stdout ??
        (err as { stderr?: string }).stderr ??
        "",
    );
    if (/have not yet been applied/i.test(output)) {
      push(
        "migrations",
        "FAIL",
        "Pending migrations detected. Run: npx prisma migrate dev (local) or npx prisma migrate deploy (prod)",
      );
    } else {
      push("migrations", "FAIL", "Unable to verify Prisma migration status");
    }
  }

  console.log("Launch Readiness");
  console.log("================");
  for (const check of checks) {
    console.log(`[${check.status}] ${check.id} - ${check.detail}`);
  }

  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warnCount = checks.filter((c) => c.status === "WARN").length;
  console.log("");
  console.log(
    `Summary: ${checks.length} checks, ${failCount} failed, ${warnCount} warnings.`,
  );

  if (failCount > 0) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error("Launch readiness script failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
