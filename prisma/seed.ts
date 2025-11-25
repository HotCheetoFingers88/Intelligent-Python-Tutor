import { PrismaClient, Role, ClassRole, Difficulty } from "@prisma/client"
import bcrypt from "bcryptjs"
import { promises as fs } from "fs"
import path from "path"

const prisma = new PrismaClient()

type BaseTestCase = {
  hidden?: boolean
  timeoutMs?: number
  globals?: Record<string, unknown>
}

type AssertTestCase = BaseTestCase & {
  type: "assert"
  expression: string
  stdin?: string
}

type FunctionTestCase = BaseTestCase & {
  type: "function"
  function: string
  args?: unknown[]
  kwargs?: Record<string, unknown>
  expected: unknown
}

type ContentTestCase = AssertTestCase | FunctionTestCase

type ContentQuestion = {
  id: string
  skill_id: string
  prompt: string
  starter?: string
  answer?: string
  difficulty: number
  tests?: ContentTestCase[]
}

const difficultyMap: Record<number, Difficulty> = {
  1: "easy",
  2: "medium",
  3: "hard",
}

const skills = [
  { id: "skill_variables", name: "Variables", order: 1 },
  { id: "skill_conditionals", name: "Conditionals", order: 2 },
  { id: "skill_loops", name: "Loops", order: 3 },
  { id: "skill_functions", name: "Functions", order: 4 },
  { id: "skill_lists", name: "Lists", order: 5 },
]

function convertContentTest(questionId: string, test: ContentTestCase) {
  if (test.type === "assert") {
    const payload: Record<string, unknown> = { mode: "assert", expression: test.expression }
    if (test.globals) {
      payload.globals = test.globals
    }
    if (test.stdin) {
      payload.stdin = test.stdin
    }

    return {
      questionId,
      input: JSON.stringify(payload),
      expectedOutput: JSON.stringify(true),
      timeoutMs: test.timeoutMs ?? 2000,
      hidden: test.hidden ?? false,
    }
  }

  if (test.type === "function") {
    if (!test.function) {
      throw new Error(`Missing function name for ${questionId}`)
    }
    const payload: Record<string, unknown> = {
      mode: "function",
      function: test.function,
      args: test.args ?? [],
      kwargs: test.kwargs ?? {},
    }
    if (test.globals) {
      payload.globals = test.globals
    }

    return {
      questionId,
      input: JSON.stringify(payload),
      expectedOutput: JSON.stringify(test.expected),
      timeoutMs: test.timeoutMs ?? 2000,
      hidden: test.hidden ?? false,
    }
  }

  throw new Error(`Unsupported test type "${(test as any)?.type}" for ${questionId}`)
}

async function main() {
  console.log("Starting seed...")

  const password = await bcrypt.hash("password123", 10)

  const student = await prisma.user.upsert({
    where: { email: "student@demo.com" },
    update: {},
    create: {
      email: "student@demo.com",
      username: "student_demo",
      passwordHash: password,
      role: Role.student,
    },
  })

  const instructor = await prisma.user.upsert({
    where: { email: "instructor@demo.com" },
    update: {},
    create: {
      email: "instructor@demo.com",
      username: "instructor_demo",
      passwordHash: password,
      role: Role.instructor,
    },
  })

  const systemUser = await prisma.user.upsert({
    where: { id: "user_system" },
    update: {},
    create: {
      id: "user_system",
      email: "system@ascend.local",
      username: "system",
      passwordHash: "$2b$10$v3JrcrWnyhqw4yVN4DyoqOA8WVLs7CV7ia23AnNP1QNN62aZW2Hh6",
      role: Role.instructor,
    },
  })

  console.log("Created users:", { student, instructor })

  const globalClass = await prisma.class.upsert({
    where: { id: "class_global_default" },
    update: {},
    create: {
      id: "class_global_default",
      name: "Global Practice",
      inviteCode: "global-practice",
      instructorId: systemUser.id,
    },
  })

  const demoClass = await prisma.class.upsert({
    where: { inviteCode: "demo-class" },
    update: {},
    create: {
      name: "Demo Cohort",
      inviteCode: "demo-class",
      instructorId: instructor.id,
    },
  })

  await prisma.enrollment.upsert({
    where: { classId_userId: { classId: demoClass.id, userId: instructor.id } },
    update: { role: ClassRole.instructor },
    create: {
      classId: demoClass.id,
      userId: instructor.id,
      role: ClassRole.instructor,
    },
  })

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        order: skill.order,
      },
      create: {
        id: skill.id,
        name: skill.name,
        order: skill.order,
      },
    })
  }
  console.log("Ensured skills:", skills.map((skill) => skill.name).join(", "))

  const questionsPath = path.join(process.cwd(), "content", "questions.json")
  const questionRaw = await fs.readFile(questionsPath, "utf8")
  const questionDefinitions: ContentQuestion[] = JSON.parse(questionRaw)

  for (const definition of questionDefinitions) {
    const difficulty = difficultyMap[definition.difficulty] ?? "medium"
    const question = await prisma.question.upsert({
      where: { id: definition.id },
      update: {
        prompt: definition.prompt,
        starter: definition.starter ?? null,
        answer: definition.answer ?? null,
        difficulty,
        skillId: definition.skill_id,
        classId: globalClass.id,
        createdById: systemUser.id,
      },
      create: {
        id: definition.id,
        prompt: definition.prompt,
        starter: definition.starter ?? null,
        answer: definition.answer ?? null,
        difficulty,
        skillId: definition.skill_id,
        classId: globalClass.id,
        createdById: systemUser.id,
      },
    })

    if (definition.tests?.length) {
      await prisma.testCase.deleteMany({ where: { questionId: question.id } })
      await prisma.testCase.createMany({
        data: definition.tests.map((test) => convertContentTest(question.id, test)),
      })
    }
  }

  const demoQuestion = await prisma.question.upsert({
    where: { id: "demo_is_even" },
    update: {},
    create: {
      id: "demo_is_even",
      prompt: "Create a function called `is_even` that returns True if the number is even.",
      starter: "def is_even(n: int) -> bool:\n    # Write your function below\n",
      answer: `def is_even(n: int) -> bool:
    return n % 2 == 0`,
      difficulty: "easy",
      skillId: "skill_functions",
      classId: demoClass.id,
      createdById: instructor.id,
    },
  })

  await prisma.testCase.deleteMany({ where: { questionId: demoQuestion.id } })
  await prisma.testCase.createMany({
    data: [
      convertContentTest(demoQuestion.id, { type: "assert", expression: "'is_even' in globals()" }),
      convertContentTest(demoQuestion.id, { type: "assert", expression: "is_even(2) is True" }),
      convertContentTest(demoQuestion.id, { type: "assert", expression: "is_even(5) is False", hidden: true }),
    ],
  })

  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("Error during seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
