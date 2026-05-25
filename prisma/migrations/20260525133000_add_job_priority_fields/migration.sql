-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "JobPost"
ADD COLUMN "priority" "JobPriority",
ADD COLUMN "priorityScore" INTEGER,
ADD COLUMN "priorityReasons" TEXT;
