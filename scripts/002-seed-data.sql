-- Seed data for the Intelligent Tutoring System

-- Insert demo users
INSERT INTO "User" ("id", "email", "role") VALUES
  ('user_student_1', 'student@example.com', 'STUDENT'),
  ('user_instructor_1', 'instructor@example.com', 'INSTRUCTOR')
ON CONFLICT ("email") DO NOTHING;

-- Insert skills
INSERT INTO "Skill" ("id", "name", "order") VALUES
  ('skill_variables', 'Variables', 1),
  ('skill_conditionals', 'Conditionals', 2),
  ('skill_loops', 'Loops', 3),
  ('skill_functions', 'Functions', 4),
  ('skill_lists', 'Lists', 5)
ON CONFLICT ("name") DO NOTHING;

-- Insert questions for Variables skill
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  ('q_var_1', 'Create a variable named "age" and assign it the value 25', 'age = ', 'age = 25', 1, 'skill_variables'),
  ('q_var_2', 'Create a variable "name" with your name as a string', 'name = ', 'name = "John"', 1, 'skill_variables'),
  ('q_var_3', 'Swap the values of two variables x and y', 'x = 5\ny = 10\n# Your code here', 'temp = x\nx = y\ny = temp', 2, 'skill_variables')
ON CONFLICT ("id") DO NOTHING;

-- Insert questions for Conditionals skill
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  ('q_cond_1', 'Write an if statement that prints "Adult" if age >= 18', 'age = 20\n', 'if age >= 18:\n    print("Adult")', 1, 'skill_conditionals'),
  ('q_cond_2', 'Write an if-else that checks if a number is positive or negative', 'num = -5\n', 'if num >= 0:\n    print("Positive")\nelse:\n    print("Negative")', 2, 'skill_conditionals'),
  ('q_cond_3', 'Write nested conditionals to grade a score (A: 90+, B: 80+, C: 70+, F: <70)', 'score = 85\n', 'if score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelif score >= 70:\n    print("C")\nelse:\n    print("F")', 3, 'skill_conditionals')
ON CONFLICT ("id") DO NOTHING;

-- Insert questions for Loops skill
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  ('q_loop_1', 'Write a for loop that prints numbers 1 to 5', '', 'for i in range(1, 6):\n    print(i)', 1, 'skill_loops'),
  ('q_loop_2', 'Write a while loop that counts down from 5 to 1', 'count = 5\n', 'while count > 0:\n    print(count)\n    count -= 1', 2, 'skill_loops'),
  ('q_loop_3', 'Use a loop to sum all numbers in a list', 'numbers = [1, 2, 3, 4, 5]\n', 'total = 0\nfor num in numbers:\n    total += num\nprint(total)', 2, 'skill_loops')
ON CONFLICT ("id") DO NOTHING;

-- Insert questions for Functions skill
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  ('q_func_1', 'Define a function that returns the square of a number', '', 'def square(n):\n    return n * n', 2, 'skill_functions'),
  ('q_func_2', 'Create a function that takes two parameters and returns their sum', '', 'def add(a, b):\n    return a + b', 2, 'skill_functions'),
  ('q_func_3', 'Write a recursive function to calculate factorial', '', 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)', 3, 'skill_functions')
ON CONFLICT ("id") DO NOTHING;

-- Insert questions for Lists skill
INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId") VALUES
  ('q_list_1', 'Create a list with three fruits', '', 'fruits = ["apple", "banana", "orange"]', 1, 'skill_lists'),
  ('q_list_2', 'Access the second element of a list', 'items = [10, 20, 30]\n', 'second = items[1]', 1, 'skill_lists'),
  ('q_list_3', 'Append a new item to a list and print the updated list', 'colors = ["red", "blue"]\n', 'colors.append("green")\nprint(colors)', 2, 'skill_lists')
ON CONFLICT ("id") DO NOTHING;
