-- CreateTable
CREATE TABLE "landing_page_drafts" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "primary_keyword" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "tone" TEXT NOT NULL,
  "cta_text" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "subheadline" TEXT NOT NULL,
  "sections" JSONB NOT NULL,
  "meta_title" TEXT,
  "meta_description" TEXT,
  "source" TEXT NOT NULL DEFAULT 'fallback',
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "landing_page_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_page_drafts_workspace_id_project_id_created_at_idx"
ON "landing_page_drafts"("workspace_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_page_drafts_workspace_id_created_at_idx"
ON "landing_page_drafts"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_page_drafts_workspace_id_slug_idx"
ON "landing_page_drafts"("workspace_id", "slug");

-- AddForeignKey
ALTER TABLE "landing_page_drafts"
ADD CONSTRAINT "landing_page_drafts_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_drafts"
ADD CONSTRAINT "landing_page_drafts_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
