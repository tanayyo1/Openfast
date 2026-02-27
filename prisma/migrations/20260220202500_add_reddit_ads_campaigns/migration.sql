-- CreateEnum
CREATE TYPE "RedditAdObjective" AS ENUM (
  'AWARENESS',
  'TRAFFIC',
  'ENGAGEMENT',
  'LEAD_GEN',
  'CONVERSIONS'
);

-- CreateEnum
CREATE TYPE "RedditAdCampaignStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED'
);

-- CreateTable
CREATE TABLE "reddit_ad_campaigns" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "reddit_account_id" TEXT,
  "name" TEXT NOT NULL,
  "objective" "RedditAdObjective" NOT NULL DEFAULT 'TRAFFIC',
  "status" "RedditAdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "daily_budget_cents" INTEGER NOT NULL,
  "lifetime_budget_cents" INTEGER,
  "start_at" TIMESTAMP(3),
  "end_at" TIMESTAMP(3),
  "target_subreddits" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "target_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "interests" JSONB,
  "headline" TEXT,
  "body" TEXT,
  "destination_url" TEXT,
  "cta_text" TEXT,
  "external_campaign_id" TEXT,
  "sync_error" TEXT,
  "launched_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reddit_ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reddit_ad_campaigns_workspace_id_created_at_idx"
ON "reddit_ad_campaigns"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "reddit_ad_campaigns_workspace_id_project_id_status_created_at_idx"
ON "reddit_ad_campaigns"("workspace_id", "project_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reddit_ad_campaigns_workspace_id_status_start_at_idx"
ON "reddit_ad_campaigns"("workspace_id", "status", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "reddit_ad_campaigns_workspace_id_external_campaign_id_key"
ON "reddit_ad_campaigns"("workspace_id", "external_campaign_id");

-- AddForeignKey
ALTER TABLE "reddit_ad_campaigns"
ADD CONSTRAINT "reddit_ad_campaigns_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reddit_ad_campaigns"
ADD CONSTRAINT "reddit_ad_campaigns_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reddit_ad_campaigns"
ADD CONSTRAINT "reddit_ad_campaigns_reddit_account_id_fkey"
FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
