-- Remove the archived status from local pre-production data before recreating the enum.
DELETE FROM "JobPost" WHERE "status" = 'ARCHIVED';

ALTER TABLE "JobPost" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "JobStatus_new" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'ERROR');

ALTER TABLE "JobPost"
  ALTER COLUMN "status" TYPE "JobStatus_new"
  USING ("status"::text::"JobStatus_new");

ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";

ALTER TABLE "JobPost" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
