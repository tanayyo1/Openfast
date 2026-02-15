-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecommendationStatus') THEN
        CREATE TYPE "RecommendationStatus" AS ENUM ('CANDIDATE', 'SELECTED', 'DISMISSED');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VisibilityCheckResult') THEN
        CREATE TYPE "VisibilityCheckResult" AS ENUM ('OK', 'SUSPICIOUS', 'FAILED', 'UNKNOWN');
    END IF;
END$$;

-- CreateTable
CREATE TABLE "project_subreddit_recos" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "fit_score" DOUBLE PRECISION NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'CANDIDATE',
    "rank" INTEGER,
    "selected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_subreddit_recos_pkey" PRIMARY KEY ("id")
);

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

-- CreateIndex
CREATE INDEX "project_subreddit_recos_workspace_id_project_id_idx" ON "project_subreddit_recos"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "project_subreddit_recos_workspace_id_status_idx" ON "project_subreddit_recos"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "project_subreddit_recos_project_id_status_idx" ON "project_subreddit_recos"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_subreddit_recos_workspace_id_created_at_idx" ON "project_subreddit_recos"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_subreddit_recos_project_id_subreddit_id_key" ON "project_subreddit_recos"("project_id", "subreddit_id");

-- CreateIndex
CREATE INDEX "account_health_snapshots_workspace_id_captured_at_idx" ON "account_health_snapshots"("workspace_id", "captured_at");

-- CreateIndex
CREATE INDEX "account_health_snapshots_reddit_account_id_captured_at_idx" ON "account_health_snapshots"("reddit_account_id", "captured_at");

-- CreateIndex
CREATE INDEX "account_health_snapshots_workspace_id_reddit_account_id_cap_idx" ON "account_health_snapshots"("workspace_id", "reddit_account_id", "captured_at");

-- CreateIndex
CREATE INDEX "visibility_checks_workspace_id_checked_at_idx" ON "visibility_checks"("workspace_id", "checked_at");

-- CreateIndex
CREATE INDEX "visibility_checks_reddit_account_id_checked_at_idx" ON "visibility_checks"("reddit_account_id", "checked_at");

-- CreateIndex
CREATE INDEX "visibility_checks_workspace_id_result_checked_at_idx" ON "visibility_checks"("workspace_id", "result", "checked_at");

-- CreateIndex
CREATE INDEX "visibility_checks_published_item_id_idx" ON "visibility_checks"("published_item_id");

-- CreateIndex
CREATE INDEX "roadmap_tasks_workspace_id_status_created_at_idx" ON "roadmap_tasks"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "drafts_workspace_id_status_updated_at_idx" ON "drafts"("workspace_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "scheduled_posts_workspace_id_status_scheduled_at_idx" ON "scheduled_posts"("workspace_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_scheduled_at_idx" ON "scheduled_posts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "published_items_workspace_id_reddit_account_id_created_at_idx" ON "published_items"("workspace_id", "reddit_account_id", "created_at");

-- CreateIndex
CREATE INDEX "published_items_subreddit_id_created_at_idx" ON "published_items"("subreddit_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_snapshots_captured_at_idx" ON "performance_snapshots"("captured_at");

-- CreateIndex
CREATE INDEX "thread_candidates_subreddit_id_status_score_idx" ON "thread_candidates"("subreddit_id", "status", "score");

-- AddForeignKey
ALTER TABLE "project_subreddit_recos" ADD CONSTRAINT "project_subreddit_recos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subreddit_recos" ADD CONSTRAINT "project_subreddit_recos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subreddit_recos" ADD CONSTRAINT "project_subreddit_recos_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_health_snapshots" ADD CONSTRAINT "account_health_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_health_snapshots" ADD CONSTRAINT "account_health_snapshots_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_checks" ADD CONSTRAINT "visibility_checks_published_item_id_fkey" FOREIGN KEY ("published_item_id") REFERENCES "published_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

