CREATE TABLE "project_pain_points" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "subreddit_id" TEXT NOT NULL,
  "phrase" TEXT NOT NULL,
  "normalized_phrase" TEXT NOT NULL,
  "severity_score" DOUBLE PRECISION NOT NULL,
  "confidence_score" DOUBLE PRECISION NOT NULL,
  "frequency" INTEGER NOT NULL,
  "evidence_count" INTEGER NOT NULL DEFAULT 1,
  "sample_titles" JSONB NOT NULL,
  "source_thread_ids" JSONB NOT NULL,
  "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_pain_points_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_pain_points_workspace_id_project_id_subreddit_id_nor_key"
ON "project_pain_points"("workspace_id", "project_id", "subreddit_id", "normalized_phrase");

CREATE INDEX "project_pain_points_workspace_id_project_id_severity_score_idx"
ON "project_pain_points"("workspace_id", "project_id", "severity_score");

CREATE INDEX "project_pain_points_workspace_id_project_id_status_severity_score_idx"
ON "project_pain_points"("workspace_id", "project_id", "status", "severity_score");

ALTER TABLE "project_pain_points"
ADD CONSTRAINT "project_pain_points_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_pain_points"
ADD CONSTRAINT "project_pain_points_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_pain_points"
ADD CONSTRAINT "project_pain_points_subreddit_id_fkey"
FOREIGN KEY ("subreddit_id") REFERENCES "subreddit_catalog"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
