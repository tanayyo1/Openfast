-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('CANDIDATE', 'SELECTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "project_subreddit_recommendations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "fit_score" DOUBLE PRECISION NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "time_window_score" DOUBLE PRECISION NOT NULL,
    "composite_score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'CANDIDATE',
    "selected_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_subreddit_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_subreddit_recommendations_workspace_id_project_id_subr_key"
ON "project_subreddit_recommendations"("workspace_id", "project_id", "subreddit_id");

-- CreateIndex
CREATE INDEX "project_subreddit_recommendations_workspace_id_project_id_compo_idx"
ON "project_subreddit_recommendations"("workspace_id", "project_id", "composite_score");

-- CreateIndex
CREATE INDEX "project_subreddit_recommendations_workspace_id_project_id_stat_idx"
ON "project_subreddit_recommendations"("workspace_id", "project_id", "status", "composite_score");

-- AddForeignKey
ALTER TABLE "project_subreddit_recommendations"
ADD CONSTRAINT "project_subreddit_recommendations_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subreddit_recommendations"
ADD CONSTRAINT "project_subreddit_recommendations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subreddit_recommendations"
ADD CONSTRAINT "project_subreddit_recommendations_subreddit_id_fkey"
FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
