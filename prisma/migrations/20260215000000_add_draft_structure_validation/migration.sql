-- AlterTable
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "structure_validation" JSONB;
