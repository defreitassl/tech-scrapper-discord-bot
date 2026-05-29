-- Projeto ainda pre-deploy: qualquer DRAFT local vira PENDING antes de recriar o enum.
UPDATE "JobPost" SET "status" = 'PENDING' WHERE "status" = 'DRAFT';

ALTER TABLE "JobPost" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "JobStatus_new" AS ENUM ('PENDING', 'SENT', 'ERROR');

ALTER TABLE "JobPost"
  ALTER COLUMN "status" TYPE "JobStatus_new"
  USING ("status"::text::"JobStatus_new");

ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";

ALTER TABLE "JobPost" ALTER COLUMN "status" SET DEFAULT 'PENDING';
