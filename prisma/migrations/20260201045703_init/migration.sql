-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'LIFETIME', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SafetyTier" AS ENUM ('NEW', 'ESTABLISHED', 'TRUSTED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PromoPolicy" AS ENUM ('ALLOWED', 'DISALLOWED', 'CONTEXTUAL_ONLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LinkPolicy" AS ENUM ('ALLOWED', 'DISALLOWED_IN_POSTS', 'DISALLOWED_IN_COMMENTS', 'DISALLOWED_EVERYWHERE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('KARMA_BUILDING', 'COMMENT', 'POST', 'REPLY', 'RESEARCH', 'CROSSPOST', 'ANALYZE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'REVIEWING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScheduledStatus" AS ENUM ('SCHEDULED', 'PENDING_APPROVAL', 'PUBLISHING', 'PUBLISHED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PublishedType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('SIGNUP', 'PURCHASE', 'UPGRADE', 'REFERRAL', 'DEMO_BOOKED', 'WAITLIST_JOINED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_entitlements" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "max_projects" INTEGER NOT NULL DEFAULT 1,
    "max_reddit_accounts" INTEGER NOT NULL DEFAULT 1,
    "max_scheduled_posts" INTEGER NOT NULL DEFAULT 10,
    "max_drafts_per_month" INTEGER NOT NULL DEFAULT 10,
    "roadmap_days" INTEGER NOT NULL DEFAULT 7,
    "has_advanced_analytics" BOOLEAN NOT NULL DEFAULT false,
    "has_smart_finder" BOOLEAN NOT NULL DEFAULT false,
    "has_team_features" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "niche" TEXT NOT NULL,
    "goals" JSONB NOT NULL,
    "brand_voice" JSONB NOT NULL,
    "constraints" JSONB,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reddit_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "reddit_username" TEXT NOT NULL,
    "reddit_user_id" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "link_karma" INTEGER NOT NULL DEFAULT 0,
    "comment_karma" INTEGER NOT NULL DEFAULT 0,
    "account_age" INTEGER NOT NULL,
    "safety_tier" "SafetyTier" NOT NULL DEFAULT 'NEW',
    "last_sync_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reddit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subscribers" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "is_quarantined" BOOLEAN NOT NULL DEFAULT false,
    "avg_posts_per_day" DOUBLE PRECISION,
    "avg_comments_per_post" DOUBLE PRECISION,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subreddit_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_rules" (
    "id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "rules_json" JSONB NOT NULL,
    "raw_rules" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "parser_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subreddit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_policy" (
    "id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "promo_allowed" "PromoPolicy" NOT NULL DEFAULT 'UNKNOWN',
    "link_policy" "LinkPolicy" NOT NULL DEFAULT 'UNKNOWN',
    "self_promo_allowed" BOOLEAN NOT NULL DEFAULT false,
    "affiliate_allowed" BOOLEAN NOT NULL DEFAULT false,
    "flair_required" BOOLEAN NOT NULL DEFAULT false,
    "min_account_age" INTEGER,
    "min_karma" INTEGER,
    "text_only" BOOLEAN NOT NULL DEFAULT false,
    "no_links_in_posts" BOOLEAN NOT NULL DEFAULT false,
    "no_links_in_comments" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subreddit_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_time_slots" (
    "id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "hour_utc" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subreddit_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmaps" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "horizon_days" INTEGER NOT NULL DEFAULT 30,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'ACTIVE',
    "strategy" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_tasks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "roadmap_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "type" "TaskType" NOT NULL,
    "subreddit_id" TEXT,
    "title" TEXT,
    "instructions" TEXT NOT NULL,
    "estimated_time" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT,
    "subreddit_id" TEXT,
    "type" "DraftType" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "media_urls" TEXT[],
    "variants" JSONB,
    "generation_params" JSONB,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_reasons" TEXT[],
    "suggested_fixes" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "reddit_account_id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "ScheduledStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "published_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "reddit_account_id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "scheduled_post_id" TEXT,
    "type" "PublishedType" NOT NULL,
    "reddit_fullname" TEXT NOT NULL,
    "reddit_id" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "url" TEXT,
    "title_snapshot" TEXT,
    "body_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL,
    "published_item_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "upvote_ratio" DOUBLE PRECISION,
    "num_comments" INTEGER NOT NULL DEFAULT 0,
    "is_removed" BOOLEAN NOT NULL DEFAULT false,
    "removal_reason" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_stickied" BOOLEAN NOT NULL DEFAULT false,
    "raw_data" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_candidates" (
    "id" TEXT NOT NULL,
    "subreddit_id" TEXT NOT NULL,
    "reddit_fullname" TEXT NOT NULL,
    "reddit_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "relevance_score" DOUBLE PRECISION NOT NULL,
    "velocity_score" DOUBLE PRECISION NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested_at" TIMESTAMP(3) NOT NULL,
    "scored_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_links" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "utm_params" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "click_link_id" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent_hash" TEXT,
    "ip_hash" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ConversionType" NOT NULL,
    "value" DOUBLE PRECISION,
    "click_link_id" TEXT,
    "utm_data" JSONB,
    "metadata" JSONB,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_entitlements_workspace_id_key" ON "workspace_entitlements"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_workspace_id_key" ON "subscriptions"("workspace_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "reddit_accounts_workspace_id_reddit_username_key" ON "reddit_accounts"("workspace_id", "reddit_username");

-- CreateIndex
CREATE INDEX "reddit_accounts_workspace_id_idx" ON "reddit_accounts"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_catalog_name_key" ON "subreddit_catalog"("name");

-- CreateIndex

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_policy_subreddit_id_key" ON "subreddit_policy"("subreddit_id");

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_time_slots_subreddit_id_day_of_week_hour_utc_key" ON "subreddit_time_slots"("subreddit_id", "day_of_week", "hour_utc");

-- CreateIndex
CREATE INDEX "roadmaps_workspace_id_idx" ON "roadmaps"("workspace_id");

-- CreateIndex
CREATE INDEX "roadmaps_project_id_idx" ON "roadmaps"("project_id");

-- CreateIndex
CREATE INDEX "roadmap_tasks_workspace_id_idx" ON "roadmap_tasks"("workspace_id");

-- CreateIndex
CREATE INDEX "roadmap_tasks_roadmap_id_idx" ON "roadmap_tasks"("roadmap_id");

-- CreateIndex
CREATE INDEX "drafts_workspace_id_idx" ON "drafts"("workspace_id");

-- CreateIndex
CREATE INDEX "drafts_project_id_idx" ON "drafts"("project_id");

-- CreateIndex
CREATE INDEX "drafts_task_id_idx" ON "drafts"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_posts_draft_id_key" ON "scheduled_posts"("draft_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_posts_idempotency_key_key" ON "scheduled_posts"("idempotency_key");

-- CreateIndex
CREATE INDEX "scheduled_posts_workspace_id_scheduled_at_idx" ON "scheduled_posts"("workspace_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_posts_reddit_account_id_scheduled_at_idx" ON "scheduled_posts"("reddit_account_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "published_items_scheduled_post_id_key" ON "published_items"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "published_items_workspace_id_created_at_idx" ON "published_items"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_snapshots_published_item_id_captured_at_idx" ON "performance_snapshots"("published_item_id", "captured_at");

-- CreateIndex
CREATE INDEX "thread_candidates_subreddit_id_score_idx" ON "thread_candidates"("subreddit_id", "score");

-- CreateIndex
CREATE INDEX "thread_candidates_expires_at_idx" ON "thread_candidates"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "click_links_slug_key" ON "click_links"("slug");

-- CreateIndex
CREATE INDEX "click_events_click_link_id_ts_idx" ON "click_events"("click_link_id", "ts");

-- CreateIndex
CREATE INDEX "conversions_project_id_ts_idx" ON "conversions"("project_id", "ts");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_entitlements" ADD CONSTRAINT "workspace_entitlements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reddit_accounts" ADD CONSTRAINT "reddit_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_rules" ADD CONSTRAINT "subreddit_rules_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_policy" ADD CONSTRAINT "subreddit_policy_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_time_slots" ADD CONSTRAINT "subreddit_time_slots_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_tasks" ADD CONSTRAINT "roadmap_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_tasks" ADD CONSTRAINT "roadmap_tasks_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_tasks" ADD CONSTRAINT "roadmap_tasks_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "roadmap_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_reddit_account_id_fkey" FOREIGN KEY ("reddit_account_id") REFERENCES "reddit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_items" ADD CONSTRAINT "published_items_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_published_item_id_fkey" FOREIGN KEY ("published_item_id") REFERENCES "published_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_candidates" ADD CONSTRAINT "thread_candidates_subreddit_id_fkey" FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_links" ADD CONSTRAINT "click_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_click_link_id_fkey" FOREIGN KEY ("click_link_id") REFERENCES "click_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
