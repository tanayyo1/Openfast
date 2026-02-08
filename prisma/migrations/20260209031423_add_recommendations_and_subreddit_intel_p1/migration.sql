-- CreateTable
CREATE TABLE "subreddit_stats_daily" (
    "id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "posts_count" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_comments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "removal_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subreddit_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_recommendations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "fit_score" DOUBLE PRECISION NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "time_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "selected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subreddit_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subreddit_stats_daily_day_idx" ON "subreddit_stats_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_stats_daily_subreddit_id_day_key" ON "subreddit_stats_daily"("subreddit_id", "day");

-- CreateIndex
CREATE INDEX "subreddit_recommendations_workspace_id_project_id_selected_idx" ON "subreddit_recommendations"("workspace_id", "project_id", "selected");

-- CreateIndex
CREATE INDEX "subreddit_recommendations_project_id_total_score_idx" ON "subreddit_recommendations"("project_id", "total_score");

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_recommendations_project_id_subreddit_id_key" ON "subreddit_recommendations"("project_id", "subreddit_id");

-- AddForeignKey
ALTER TABLE "subreddit_stats_daily" ADD CONSTRAINT "subreddit_stats_daily_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_recommendations" ADD CONSTRAINT "subreddit_recommendations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_recommendations" ADD CONSTRAINT "subreddit_recommendations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_recommendations" ADD CONSTRAINT "subreddit_recommendations_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

