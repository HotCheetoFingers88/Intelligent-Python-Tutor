-- Create tables for the Intelligent Tutoring System

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STUDENT',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Skills table
CREATE TABLE IF NOT EXISTS "Skill" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT UNIQUE NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS "Question" (
  "id" TEXT PRIMARY KEY,
  "prompt" TEXT NOT NULL,
  "starter" TEXT,
  "answer" TEXT,
  "difficulty" INTEGER NOT NULL,
  "skillId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
);

-- Attempts table
CREATE TABLE IF NOT EXISTS "Attempt" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "elapsedMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
);

-- Mastery table
CREATE TABLE IF NOT EXISTS "Mastery" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "pKnown" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id"),
  UNIQUE ("userId", "skillId")
);

-- Recommendations table
CREATE TABLE IF NOT EXISTS "Recommendation" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_question_skill" ON "Question"("skillId");
CREATE INDEX IF NOT EXISTS "idx_attempt_user" ON "Attempt"("userId");
CREATE INDEX IF NOT EXISTS "idx_attempt_question" ON "Attempt"("questionId");
CREATE INDEX IF NOT EXISTS "idx_mastery_user" ON "Mastery"("userId");
CREATE INDEX IF NOT EXISTS "idx_recommendation_user" ON "Recommendation"("userId");
