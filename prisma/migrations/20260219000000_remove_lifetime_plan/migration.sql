-- Safety: migrate any test data with LIFETIME to PRO
UPDATE "workspaces" SET "plan" = 'PRO' WHERE "plan" = 'LIFETIME';

-- PostgreSQL can't remove enum values, so swap the type
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
ALTER TABLE "workspaces" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
