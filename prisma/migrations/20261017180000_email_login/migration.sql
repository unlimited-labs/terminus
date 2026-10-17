-- AlterTable
ALTER TABLE "exam" ADD COLUMN     "requireEmailLogin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "roster_entry" ADD COLUMN     "email" TEXT;
UPDATE "roster_entry" SET "email" = "studentNumber" || '@student.agh.edu.pl';
ALTER TABLE "roster_entry" ALTER COLUMN "email" SET NOT NULL;

-- Link logowania nie może kasować kont prowadzących (Better Auth czyści konta niezweryfikowanego użytkownika).
UPDATE "user" SET "emailVerified" = true;
