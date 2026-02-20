/**
 * Quick verification script for auth setup
 * Run: npx tsx scripts/verify-auth.ts
 */

import { prisma } from "@/lib/prisma";
import { getTokenKeyring } from "@/lib/security/tokenCrypto";

function validateRedditRedirectUri(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.pathname === "/api/reddit/oauth/callback";
  } catch {
    return false;
  }
}

async function verifySetup() {
  console.log("🔍 Verifying Auth Setup...\n");
  let warnings = 0;
  const warn = (message: string) => {
    warnings += 1;
    console.warn(message);
  };

  // 1. Check database connection
  try {
    await prisma.$queryRaw`SELECT 1 as connected`;
    console.log("✅ Database connection: OK");
    console.log(
      `   URL: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "localhost"}\n`,
    );
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }

  // 2. Check Supabase env vars
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("❌ Supabase environment variables missing");
    process.exit(1);
  }
  console.log("✅ Supabase environment variables: OK");
  console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  // 3. Test Supabase connection (direct API call)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      new URL("/auth/v1/settings", process.env.NEXT_PUBLIC_SUPABASE_URL),
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timer));
    if (!res.ok) {
      throw new Error(`SUPABASE_STATUS_${res.status}`);
    }
    console.log("✅ Supabase API connection: OK\n");
  } catch (error) {
    console.error("❌ Supabase API connection failed:", error);
    console.error(
      "   Hint: verify NEXT_PUBLIC_SUPABASE_URL host resolves and key is valid.",
    );
    process.exit(1);
  }

  // 4. Check database schema
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = (tables as any[]).map((t) => t.table_name);
    const requiredTables = [
      "users",
      "workspaces",
      "projects",
      "accounts",
      "sessions",
    ];
    const missingTables = requiredTables.filter((t) => !tableNames.includes(t));

    if (missingTables.length === 0) {
      console.log(`✅ Database schema: OK (${tableNames.length} tables)`);
    } else {
      warn(`⚠️  Missing tables: ${missingTables.join(", ")}`);
    }

    console.log(
      `   Tables found: ${tableNames.slice(0, 10).join(", ")}${tableNames.length > 10 ? "..." : ""}\n`,
    );
  } catch (error) {
    warn(`⚠️  Schema check failed: ${String(error)}`);
  }

  // 5. Check auth_id column exists in users table
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `;
    const columnNames = (columns as any[]).map((c) => c.column_name);

    if (columnNames.includes("auth_id")) {
      console.log(
        "✅ Supabase Auth integration: OK (auth_id column present)\n",
      );
    } else {
      warn("⚠️  auth_id column missing - run: npx prisma db push\n");
    }
  } catch (error) {
    warn(`⚠️  Column check failed: ${String(error)}`);
  }

  // 6. Validate token encryption keys
  try {
    const keyring = getTokenKeyring();
    if (Object.keys(keyring).length > 0) {
      console.log("✅ Token encryption keys: OK\n");
    } else {
      warn(
        "⚠️  TOKEN_ENCRYPTION_KEYS missing or invalid (Reddit token storage will fail)\n",
      );
    }
  } catch (error) {
    warn(`⚠️  Token encryption key check failed: ${String(error)}`);
  }

  // 7. Validate Reddit OAuth callback route format
  const redirectUri = process.env.REDDIT_REDIRECT_URI;
  if (!redirectUri) {
    warn("⚠️  REDDIT_REDIRECT_URI missing\n");
  } else if (!validateRedditRedirectUri(redirectUri)) {
    warn(
      `⚠️  REDDIT_REDIRECT_URI should be a valid URL with path /api/reddit/oauth/callback (current: ${redirectUri})\n`,
    );
  } else {
    console.log("✅ Reddit OAuth redirect URI format: OK\n");
  }

  if (warnings === 0) {
    console.log("🎉 All checks passed! Auth system is ready.");
  } else {
    console.log(`⚠️  Auth verification completed with ${warnings} warning(s).`);
  }
  console.log("\n📋 Next steps:");
  console.log("   1. Open http://localhost:3000/signup");
  console.log("   2. Create a test account with email/password");
  console.log(
    "   3. Check Supabase Dashboard → Auth → Users (user should appear)",
  );
  console.log(
    "   4. Check local database → users table (should have auth_id linked)",
  );
  console.log("\n⚡ Quick test command:");
  console.log("   curl http://localhost:3000/api/auth/sync -X POST");

  await prisma.$disconnect();
}

verifySetup().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
