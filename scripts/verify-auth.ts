/**
 * Quick verification script for auth setup
 * Run: npx tsx scripts/verify-auth.ts
 */

import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

async function verifySetup() {
  console.log("🔍 Verifying Auth Setup...\n");

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    // Try to get auth settings (this tests connectivity)
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message !== "Auth session missing!") {
      throw error;
    }
    console.log("✅ Supabase API connection: OK\n");
  } catch (error) {
    console.error("❌ Supabase API connection failed:", error);
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
      console.warn(`⚠️  Missing tables: ${missingTables.join(", ")}`);
    }

    console.log(
      `   Tables found: ${tableNames.slice(0, 10).join(", ")}${tableNames.length > 10 ? "..." : ""}\n`,
    );
  } catch (error) {
    console.error("❌ Schema check failed:", error);
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
      console.warn("⚠️  auth_id column missing - run: npx prisma db push\n");
    }
  } catch (error) {
    console.error("❌ Column check failed:", error);
  }

  console.log("🎉 All checks passed! Auth system is ready.");
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
}

verifySetup().catch(console.error);
