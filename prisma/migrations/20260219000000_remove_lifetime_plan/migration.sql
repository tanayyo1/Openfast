-- Safety: migrate any test data with LIFETIME to PRO
UPDATE "workspaces" SET "plan" = 'PRO' WHERE "plan" = 'LIFETIME';

-- PostgreSQL can't remove enum values, so swap the type.
-- Drop/recreate the default around the type change to avoid cast errors.
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
ALTER TABLE "workspaces" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "workspaces" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TABLE "workspaces" ALTER COLUMN "plan" SET DEFAULT 'FREE';
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
