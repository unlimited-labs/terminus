-- CreateTable
CREATE TABLE "_ExamTeachers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExamTeachers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ExamTeachers_B_index" ON "_ExamTeachers"("B");

-- AddForeignKey
ALTER TABLE "_ExamTeachers" ADD CONSTRAINT "_ExamTeachers_A_fkey" FOREIGN KEY ("A") REFERENCES "exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExamTeachers" ADD CONSTRAINT "_ExamTeachers_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dotychczasowy właściciel zostaje prowadzącym swoich zaliczeń.
INSERT INTO "_ExamTeachers" ("A", "B") SELECT "id", "ownerId" FROM "exam";
