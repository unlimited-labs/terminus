-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('G2', 'G3', 'G3_5', 'G4', 'G4_5', 'G5', 'ABSENT');

-- AlterTable
ALTER TABLE "enrollment" ADD COLUMN     "grade" "Grade",
ADD COLUMN     "gradeComment" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMPTZ,
ADD COLUMN     "gradedById" TEXT;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
