-- DropForeignKey
ALTER TABLE "exam" DROP CONSTRAINT "exam_ownerId_fkey";

-- DropIndex
DROP INDEX "exam_ownerId_idx";

-- AlterTable
ALTER TABLE "exam" DROP COLUMN "ownerId";
