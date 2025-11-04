-- Seed database from JSON files
-- This script demonstrates how the JSON domain model feeds the database

-- Note: In production, use a proper seed script (TypeScript/Python) to read JSON
-- This SQL version shows the structure for manual seeding

-- Clear existing data (optional - comment out if you want to keep data)
-- DELETE FROM "Recommendation";
-- DELETE FROM "Mastery";
-- DELETE FROM "Attempt";
-- DELETE FROM "Question";
-- DELETE FROM "Skill";
-- DELETE FROM "User";

-- Insert demo users
INSERT INTO "User" ("id", "email", "role") VALUES
  ('user_student_1', 'student@example.com', 'STUDENT'),
  ('user_instructor_1', 'instructor@example.com', 'INSTRUCTOR')
ON CONFLICT ("email") DO NOTHING;

-- Skills from content/skills.json
INSERT INTO "Skill" ("id", "name", "order") VALUES
  ('skill_variables', 'Variables', 1),
  ('skill_conditionals', 'Conditionals', 2),
  ('skill_loops', 'Loops', 3),
  ('skill_functions', 'Functions', 4),
  ('skill_lists', 'Lists', 5)
ON CONFLICT ("name") DO NOTHING;

-- Questions from content/questions.json
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  -- Variables
  ('q_var_1', 'Create a variable named age and assign it the value 25.', 'age = ', 'age = 25', 1, 'skill_variables'),
  ('q_var_2', 'Store your first name inside a variable called student_name.', 'student_name = ', 'student_name = "Ada"', 1, 'skill_variables'),
  ('q_var_3', 'Swap the values of variables x and y using a temporary variable.', 'x = 5\ny = 10\n', 'temp = x\nx = y\ny = temp', 2, 'skill_variables'),

  -- Conditionals
  ('q_cond_1', 'Write an if statement that prints "Adult" when age is at least 18.', 'age = 20\n', 'if age >= 18:\n    print("Adult")', 1, 'skill_conditionals'),
  ('q_cond_2', 'Use an if/else block to print whether num is positive or negative.', 'num = -5\n', 'if num >= 0:\n    print("Positive")\nelse:\n    print("Negative")', 2, 'skill_conditionals'),
  ('q_cond_3', 'Grade a score using nested conditionals (A: 90+, B: 80+, C: 70+, otherwise F).', 'score = 85\n', 'if score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelif score >= 70:\n    print("C")\nelse:\n    print("F")', 3, 'skill_conditionals'),

  -- Loops
  ('q_loop_1', 'Write a for loop that prints the numbers 1 through 5 each on a new line.', 'for i in ', 'for i in range(1, 6):\n    print(i)', 1, 'skill_loops'),
  ('q_loop_2', 'Complete the while loop so it counts down from 5 to 1.', 'count = 5\nwhile ', 'count = 5\nwhile count > 0:\n    print(count)\n    count -= 1', 2, 'skill_loops'),
  ('q_loop_3', 'Use a loop to compute the total of all numbers in the list.', 'numbers = [1, 2, 3, 4, 5]\ntotal = 0\n', 'numbers = [1, 2, 3, 4, 5]\ntotal = 0\nfor num in numbers:\n    total += num\nprint(total)', 2, 'skill_loops'),
  ('q_loop_4', 'Build a string called row that contains the 7 times table from 7 to 70 separated by spaces.', 'row = ""\nfor n in range(1, 11):\n    ', 'row = ""\nfor n in range(1, 11):\n    row += f"{7 * n} "\nprint(row.strip())', 3, 'skill_loops'),

  -- Functions
  ('q_func_1', 'Define a function named square that returns the square of a number.', 'def square(n):\n    ', 'def square(n):\n    return n * n', 2, 'skill_functions'),
  ('q_func_2', 'Create a function add that returns the sum of two numbers a and b.', 'def add(a, b):\n    ', 'def add(a, b):\n    return a + b', 2, 'skill_functions'),
  ('q_func_3', 'Write a recursive function factorial that multiplies numbers down to 1.', 'def factorial(n):\n    ', 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)', 3, 'skill_functions'),

  -- Lists
  ('q_list_1', 'Create a list named fruits that contains three strings.', 'fruits = ', 'fruits = ["apple", "banana", "orange"]', 1, 'skill_lists'),
  ('q_list_2', 'Store the second element of items inside the variable second.', 'items = [10, 20, 30]\n', 'items = [10, 20, 30]\nsecond = items[1]', 1, 'skill_lists'),
  ('q_list_3', 'Append "green" to the colors list and print the updated list.', 'colors = ["red", "blue"]\n', 'colors.append("green")\nprint(colors)', 2, 'skill_lists')
ON CONFLICT ("id") DO NOTHING;

-- Baseline mastery to drive adaptive behaviour in demos
INSERT INTO "Mastery" ("id", "userId", "skillId", "pKnown", "updatedAt") VALUES
  ('seed_mastery_variables', 'user_student_1', 'skill_variables', 0.92, NOW()),
  ('seed_mastery_conditionals', 'user_student_1', 'skill_conditionals', 0.20, NOW()),
  ('seed_mastery_loops', 'user_student_1', 'skill_loops', 0.25, NOW()),
  ('seed_mastery_functions', 'user_student_1', 'skill_functions', 0.80, NOW()),
  ('seed_mastery_lists', 'user_student_1', 'skill_lists', 0.70, NOW())
ON CONFLICT ("userId", "skillId") DO UPDATE SET "pKnown" = EXCLUDED."pKnown", "updatedAt" = NOW();
