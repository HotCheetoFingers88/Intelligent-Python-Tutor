-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'instructor');

-- DropForeignKey
ALTER TABLE "public"."Attempt" DROP CONSTRAINT "Attempt_questionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Attempt" DROP CONSTRAINT "Attempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mastery" DROP CONSTRAINT "Mastery_skillId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mastery" DROP CONSTRAINT "Mastery_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Question" DROP CONSTRAINT "Question_skillId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Recommendation" DROP CONSTRAINT "Recommendation_skillId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Recommendation" DROP CONSTRAINT "Recommendation_userId_fkey";

-- AlterTable
ALTER TABLE "Attempt" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Mastery" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Recommendation" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Skill" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "username" TEXT,
ADD COLUMN     "role_new" "Role" NOT NULL DEFAULT 'student'::"Role",
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

WITH username_candidates AS (
    SELECT
        id,
        lower(split_part(email, '@', 1)) AS base,
        ROW_NUMBER() OVER (PARTITION BY lower(split_part(email, '@', 1)) ORDER BY id) AS rn
    FROM "User"
)
UPDATE "User"
SET "username" = CASE
    WHEN username_candidates.rn = 1 THEN username_candidates.base
    ELSE username_candidates.base || '_' || username_candidates.rn
END
FROM username_candidates
WHERE "User".id = username_candidates.id;

UPDATE "User"
SET "passwordHash" = '$2b$10$aQUM.rnV5/qBxB4UYcxxE.wcwzasC3oV0OdRefjN6HKe/kZe/6kuu'
WHERE "passwordHash" IS NULL;

UPDATE "User"
SET "updatedAt" = NOW()
WHERE "updatedAt" IS NULL;

UPDATE "User"
SET "role_new" = CASE
    WHEN lower("role") = 'instructor' THEN 'instructor'
    ELSE 'student'
END::"Role";

ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

ALTER TABLE "User"
ALTER COLUMN "passwordHash" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mastery" ADD CONSTRAINT "Mastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mastery" ADD CONSTRAINT "Mastery_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
