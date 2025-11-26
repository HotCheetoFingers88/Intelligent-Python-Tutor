\set skills_json `cat content/skills.json`
\set questions_json `cat content/questions.json`

BEGIN;

WITH upsert AS (
  INSERT INTO "User" ("id", "email", "username", "passwordHash", "role", "createdAt", "updatedAt")
  VALUES (
    'user_student_seed',
    'student@example.com',
    'student',
    -- bcrypt hash for "password123" (12 rounds)
    '$2b$12$Y2NCVd733fI7MzAs4aVV/OD4ZY6SqPILAf8I8NjYWDZBZU35T1V8W',
    'student',
    NOW(),
    NOW()
  )
  ON CONFLICT ("email") DO UPDATE SET
    "username" = EXCLUDED."username",
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "updatedAt" = NOW()
  RETURNING "id"
)
SELECT id AS student_id FROM upsert;
\gset

WITH upsert AS (
  INSERT INTO "User" ("id", "email", "username", "passwordHash", "role", "createdAt", "updatedAt")
  VALUES (
    'user_instructor_seed',
    'instructor@example.com',
    'instructor',
    -- bcrypt hash for "password123" (12 rounds)
    '$2b$12$Y2NCVd733fI7MzAs4aVV/OD4ZY6SqPILAf8I8NjYWDZBZU35T1V8W',
    'instructor',
    NOW(),
    NOW()
  )
  ON CONFLICT ("email") DO UPDATE SET
    "username" = EXCLUDED."username",
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "updatedAt" = NOW()
  RETURNING "id"
)
SELECT id AS instructor_id FROM upsert;
\gset

WITH skill_data AS (
  SELECT
    skill->>'id' AS id,
    skill->>'name' AS name,
    (skill->>'order')::int AS "order"
  FROM jsonb_array_elements(:'skills_json'::jsonb) AS skill
)
INSERT INTO "Skill" ("id", "name", "order")
SELECT id, name, "order"
FROM skill_data
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "order" = EXCLUDED."order";

INSERT INTO "Class" ("id", "name", "inviteCode", "instructorId") VALUES
  ('class_global_default', 'CIS 3750', 'join3750', :'instructor_id')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "inviteCode" = EXCLUDED."inviteCode",
  "instructorId" = EXCLUDED."instructorId";

WITH question_data AS (
  SELECT
    q->>'id' AS id,
    q->>'skill_id' AS skill_id,
    q->>'prompt' AS prompt,
    q->>'starter' AS starter,
    q->>'answer' AS answer,
    CASE
      WHEN (q->>'difficulty') ~ '^[0-9]+$' THEN
        CASE (q->>'difficulty')::int
          WHEN 1 THEN 'easy'
          WHEN 3 THEN 'hard'
          ELSE 'medium'
        END
      ELSE COALESCE(NULLIF(q->>'difficulty', ''), 'medium')
    END AS difficulty_label
  FROM jsonb_array_elements(:'questions_json'::jsonb) AS q
)
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId", "classId", "createdById")
SELECT
  id,
  prompt,
  starter,
  answer,
  (difficulty_label)::"Difficulty",
  skill_id,
  'class_global_default',
  :'instructor_id'
FROM question_data
ON CONFLICT ("id") DO UPDATE SET
  "prompt" = EXCLUDED."prompt",
  "starter" = EXCLUDED."starter",
  "answer" = EXCLUDED."answer",
  "difficulty" = EXCLUDED."difficulty",
  "skillId" = EXCLUDED."skillId",
  "classId" = EXCLUDED."classId",
  "createdById" = EXCLUDED."createdById";

-- Remove legacy test cases for Variables questions so the app can re-hydrate simplified tests from content/questions.json
DELETE FROM "TestCase" WHERE "questionId" IN ('q_var_1', 'q_var_2');

-- Baseline mastery to drive adaptive behaviour in demos
INSERT INTO "Mastery" ("id", "userId", "skillId", "pKnown", "updatedAt") VALUES
  ('seed_mastery_variables', :'student_id', 'skill_variables', 0.20, NOW()),
  ('seed_mastery_conditionals', :'student_id', 'skill_conditionals', 0.60, NOW()),
  ('seed_mastery_loops', :'student_id', 'skill_loops', 0.55, NOW()),
  ('seed_mastery_functions', :'student_id', 'skill_functions', 0.70, NOW()),
  ('seed_mastery_lists', :'student_id', 'skill_lists', 0.65, NOW())
ON CONFLICT ("userId", "skillId") DO UPDATE SET "pKnown" = EXCLUDED."pKnown", "updatedAt" = NOW();

COMMIT;
