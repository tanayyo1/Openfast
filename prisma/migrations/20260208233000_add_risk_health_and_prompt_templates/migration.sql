-- CreateEnum
CREATE TYPE "VisibilityCheckResult" AS ENUM ('OK', 'SUSPICIOUS', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "account_health_snapshots" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "reddit_account_id" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "health_score" DOUBLE PRECISION NOT NULL,
  "signals_json" JSONB NOT NULL,
  CONSTRAINT "account_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_checks" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "reddit_account_id" TEXT NOT NULL,
  "published_item_id" TEXT,
  "permalink" TEXT NOT NULL,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visible_logged_in" BOOLEAN,
  "visible_logged_out" BOOLEAN,
  "visible_alt" BOOLEAN,
  "result" "VisibilityCheckResult" NOT NULL DEFAULT 'UNKNOWN',
  "signals_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visibility_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "variables" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "account_health_snapshots_workspace_id_captured_at_idx" ON "account_health_snapshots"("workspace_id", "captured_at");
CREATE INDEX "account_health_snapshots_reddit_account_id_captured_at_idx" ON "account_health_snapshots"("reddit_account_id", "captured_at");
CREATE INDEX "account_health_snapshots_workspace_id_reddit_account_id_cap_idx" ON "account_health_snapshots"("workspace_id", "reddit_account_id", "captured_at");
CREATE INDEX "visibility_checks_workspace_id_checked_at_idx" ON "visibility_checks"("workspace_id", "checked_at");
CREATE INDEX "visibility_checks_reddit_account_id_checked_at_idx" ON "visibility_checks"("reddit_account_id", "checked_at");
CREATE INDEX "visibility_checks_workspace_id_result_checked_at_idx" ON "visibility_checks"("workspace_id", "result", "checked_at");
CREATE INDEX "visibility_checks_published_item_id_idx" ON "visibility_checks"("published_item_id");
CREATE UNIQUE INDEX "prompt_templates_key_version_key" ON "prompt_templates"("key", "version");
CREATE INDEX "prompt_templates_key_is_active_idx" ON "prompt_templates"("key", "is_active");

-- FKs
ALTER TABLE "account_health_snapshots" ADD CONSTRAINT "account_health_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_health_snapshots" ADD CONSTRAINT "account_health_snapshots_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_published_item_id_fkey" FOREIGN KEY ("published_item_id") REFERENCES "published_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
