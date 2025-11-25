import { NextResponse } from "next/server"
import { ClassRole, Difficulty } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"

type RouteContext = {
  params: { classId: string }
}

async function requireInstructor(classId: string, userId: string) {
  const klass = await prisma.class.findFirst({
    where: {
      id: classId,
      instructorId: userId,
    },
    select: { id: true },
  })

  return Boolean(klass)
}

export async function GET(_: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user || user.role.toLowerCase() !== "instructor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { classId } = context.params
  const hasAccess = await requireInstructor(classId, user.id)
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const questions = await prisma.question.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    include: {
      skill: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      skillId: question.skillId,
      skillName: question.skill.name,
      difficulty: question.difficulty,
      createdAt: question.createdAt,
    })),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user || user.role.toLowerCase() !== "instructor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { classId } = context.params
  const hasAccess = await requireInstructor(classId, user.id)
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const skillId = typeof body?.skillId === "string" ? body.skillId : ""
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty : "medium"
  const starterCode =
    typeof body?.starterCode === "string" && body.starterCode.length > 0 ? body.starterCode : null
  const answer = typeof body?.answer === "string" && body.answer.length > 0 ? body.answer : null
  const testCasesInput = Array.isArray(body?.testCases) ? body.testCases : []

  if (!skillId || !prompt) {
    return NextResponse.json({ error: "Skill and prompt are required" }, { status: 400 })
  }

  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 })
  }

  if (testCasesInput.length < 3 || testCasesInput.length > 10) {
    return NextResponse.json({ error: "Provide between 3 and 10 test cases" }, { status: 400 })
  }

  const testCasesData = []
  for (let i = 0; i < testCasesInput.length; i += 1) {
    const testCase = testCasesInput[i]
    if (typeof testCase?.input !== "string" || typeof testCase?.expectedOutput !== "string") {
      return NextResponse.json({ error: `Test case #${i + 1} must include input and expectedOutput strings` }, { status: 400 })
    }
    try {
      JSON.parse(testCase.input)
      JSON.parse(testCase.expectedOutput)
    } catch {
      return NextResponse.json({ error: `Test case #${i + 1} contains invalid JSON` }, { status: 400 })
    }
    const timeoutMs =
      typeof testCase.timeoutMs === "number" && Number.isFinite(testCase.timeoutMs) ? testCase.timeoutMs : 2000
    testCasesData.push({
      input: testCase.input.trim(),
      expectedOutput: testCase.expectedOutput.trim(),
      timeoutMs: Math.max(250, Math.min(timeoutMs, 6000)),
      hidden: Boolean(testCase.hidden),
    })
  }

  const question = await prisma.question.create({
    data: {
      prompt,
      starter: starterCode,
      answer,
      difficulty: difficulty as Difficulty,
      skillId,
      classId,
      createdById: user.id,
      testCases: {
        createMany: {
          data: testCasesData,
        },
      },
    },
  })

  return NextResponse.json({ question }, { status: 201 })
}
