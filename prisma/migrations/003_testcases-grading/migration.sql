-- Add JSON details blob for richer grading metadata
ALTER TABLE "Attempt" ADD COLUMN "details" JSONB;

-- Store per-question automated test cases
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 2000,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TestCase_questionId_idx" ON "TestCase"("questionId");

ALTER TABLE "TestCase"
  ADD CONSTRAINT "TestCase_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
