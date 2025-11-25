-- CreateEnum
CREATE TYPE "ClassRole" AS ENUM ('student', 'instructor');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Class_inviteCode_key" ON "Class"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_classId_userId_key" ON "Enrollment"("classId", "userId");

-- Seed system instructor and global class for existing questions
INSERT INTO "User" ("id", "email", "username", "passwordHash", "role", "createdAt", "updatedAt")
VALUES ('user_system', 'system@ascend.local', 'system', '$2b$10$v3JrcrWnyhqw4yVN4DyoqOA8WVLs7CV7ia23AnNP1QNN62aZW2Hh6', 'instructor', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Class" ("id", "name", "inviteCode", "instructorId", "createdAt")
VALUES ('class_global_default', 'Global Practice', 'global-practice', 'user_system', NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Enrollment" ("id", "classId", "userId", "role", "createdAt")
VALUES ('enroll_global_instructor', 'class_global_default', 'user_system', 'instructor', NOW())
ON CONFLICT ("classId", "userId") DO NOTHING;

-- Add new columns for Question as nullable to allow backfill
ALTER TABLE "Question"
ADD COLUMN "classId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "difficulty_new" "Difficulty" NOT NULL DEFAULT 'medium';

-- Backfill difficulty values and associate legacy questions to the global class
UPDATE "Question"
SET
  "difficulty_new" = (
    CASE
      WHEN "difficulty" <= 1 THEN 'easy'
      WHEN "difficulty" = 2 THEN 'medium'
      WHEN "difficulty" >= 3 THEN 'hard'
      ELSE 'medium'
    END
  )::"Difficulty",
  "classId" = 'class_global_default',
  "createdById" = 'user_system';

-- Make the new columns required
ALTER TABLE "Question"
ALTER COLUMN "classId" SET NOT NULL,
ALTER COLUMN "createdById" SET NOT NULL;

-- Replace the old difficulty column
ALTER TABLE "Question" DROP COLUMN "difficulty";
ALTER TABLE "Question" RENAME COLUMN "difficulty_new" TO "difficulty";

-- CreateIndex
CREATE INDEX "Question_classId_idx" ON "Question"("classId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
