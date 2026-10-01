-- AlterTable
ALTER TABLE "enrollment" ADD COLUMN     "answers" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "exam" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '[]';
