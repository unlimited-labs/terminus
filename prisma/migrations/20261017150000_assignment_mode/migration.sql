-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('RANDOM', 'MANUAL');

-- AlterTable
ALTER TABLE "exam" ADD COLUMN     "assignmentMode" "AssignmentMode" NOT NULL DEFAULT 'RANDOM';
