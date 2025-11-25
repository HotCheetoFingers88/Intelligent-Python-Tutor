import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"
import { getContentQuestionById, type ContentQuestion } from "@/lib/content/questions"

type AttemptEntry = {
  correct: boolean
  elapsedMs: number | null
  createdAt: string
}

type HintRecommendation = "simple" | "scaffold" | "worked_example"
type UiHintTier = "simple" | "medium" | "worked_example"

type MlFeedback = {
  state?: "steady_progress" | "needs_scaffold" | "needs_review" | string
  hintLevel?: HintRecommendation
  message?: string
  encouragement?: string
  tone?: string
  confidence?: number
}

type RawGradeResult = {
  index: number
  status: "pass" | "fail" | "timeout" | "error"
  stdout?: string | null
  stderr?: string | null
  actual?: string | null
  expected?: string | null
  input_summary?: string | null
}

type FormattedTestResult = {
  index: number
  label: string
  hidden: boolean
  status: RawGradeResult["status"]
  stdout?: string | null
  stderr?: string | null
}

const hintLibrary: Record<
  string,
  {
    initial: string
    scaffold: string
    review: string
  }
> = {
  skill_variables: {
    initial: "Mirror the prompt: write the variable name exactly, add =, then the value (quotes for text, plain number otherwise).",
    scaffold: "Name the variable first, then assign the exact value shown in the prompt.",
    review: "Revisit simple assignments and rebuild this one from scratch.",
  },
  skill_conditionals: {
    initial: "Write if <condition>: with the comparison from the prompt, keep the body indented on the next line.",
    scaffold: "Use elif/else blocks to cover the remaining outcomes, keeping the indentation tight.",
    review: "Skim a quick example of if/elif/else and apply that pattern here.",
  },
  skill_loops: {
    initial: "Start the correct loop (for or while) and update the counter or iterable so it runs exactly the number of times described.",
    scaffold: "Update the counter every pass so the loop progresses toward its stop condition.",
    review: "Review a basic loop example and adapt it line by line for this task.",
  },
  skill_functions: {
    initial: "Define the function with def name(params): and end with a return that matches the description.",
    scaffold: "Walk through a sample input to decide exactly what the function should return.",
    review: "Glance at a short function example and match the structure here.",
  },
  skill_lists: {
    initial: "Use a list literal in square brackets or the list method mentioned (e.g. append) to perform the exact action requested.",
    scaffold: "Call the method or index that lines up with what the prompt is asking for.",
    review: "Review a quick list example, then rebuild your answer with fresh syntax.",
  },
}

const praiseLibrary: Record<string, string[]> = {
  skill_variables: [
    "Excellent control over your variables! 🎯",
    "Great work! Your variable assignment is spot on.",
  ],
  skill_conditionals: [
    "Nice job navigating that conditional logic! ✅",
    "Your branching logic is getting really strong.",
  ],
  skill_loops: [
    "You handled that loop like a pro! 🔁",
    "Great iteration strategy—keep that momentum going.",
  ],
  skill_functions: [
    "Functionally marvelous! Your abstraction is clean. 🧠",
    "Great job defining that function with clarity.",
  ],
  skill_lists: [
    "List operations are looking sharp! 📚",
    "Nice work manipulating that list structure.",
  ],
}

function getPraise(skillId: string): string {
  const options = praiseLibrary[skillId]
  if (!options || options.length === 0) {
    return "Great job! You're building solid mastery."
  }
  const randomIndex = Math.floor(Math.random() * options.length)
  return options[randomIndex]
}

function getConsecutiveIncorrect(entries: AttemptEntry[]): number {
  let streak = 0
  for (const entry of entries) {
    if (entry.correct) {
      streak = 0
    } else {
      streak += 1
    }
  }
  return streak
}

function normalizeCode(code: string): string {
  return code
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\s+/g, " ")
    .replace(/'/g, '"')
    .trim()
}

function compareCode(student: string, expected: string | null): boolean {
  if (!expected) return false
  const normalizedStudent = normalizeCode(student)
  const normalizedExpected = normalizeCode(expected)

  if (normalizedStudent === normalizedExpected) {
    return true
  }

  return normalizedStudent.replace(/\s+/g, "") === normalizedExpected.replace(/\s+/g, "")
}

function difficultyToNumber(value: string | number | null | undefined) {
  if (value === "easy" || value === 1) return 1
  if (value === "hard" || value === 3) return 3
  return 2
}

function buildPedagogicalFeedback({
  correct,
  question,
  mastery,
  consecutiveIncorrect,
  attemptCount,
  mlFeedback,
}: {
  correct: boolean
  question: { skillId: string; difficulty: "easy" | "medium" | "hard"; answer: string | null }
  mastery: number
  consecutiveIncorrect: number
  attemptCount: number
  mlFeedback: MlFeedback
}): {
  message: string
  hint?: string
  workedExample?: string
  encouragement?: string
  tone?: string
  nextAction: "advance" | "retry" | "focus_skill"
  feedbackType: string
} {
  const fallbackState = correct
    ? "steady_progress"
    : consecutiveIncorrect >= 2
      ? "needs_review"
      : "needs_scaffold"
  const state = (mlFeedback.state as MlFeedback["state"]) ?? (fallbackState as MlFeedback["state"])
  const hintLevel: HintRecommendation =
    correct ? "simple" : mlFeedback.hintLevel ?? (state === "needs_review" ? "worked_example" : "scaffold")

  const nextAction: "advance" | "retry" | "focus_skill" =
    state === "needs_review" ? "focus_skill" : correct ? "advance" : "retry"
  const feedbackType = correct ? "praise" : hintLevel === "worked_example" ? "worked_example" : "hint"

  if (correct) {
    const message =
      mlFeedback.message ??
      (mastery >= 0.8
        ? "Excellent work! You've mastered this concept."
        : mastery >= 0.6
          ? "Great job! Your understanding is improving."
          : "Well done! You're making progress.")
    return {
      message,
      hint: undefined,
      workedExample: undefined,
      encouragement:
        mlFeedback.encouragement ??
        (mastery >= 0.8
          ? "Take on a harder challenge or explore the next concept."
          : "Keep the momentum going. You're building mastery."),
      tone: mlFeedback.tone ?? (mastery >= 0.8 ? "celebratory" : "encouraging"),
      nextAction,
      feedbackType,
    }
  }

  let message = mlFeedback.message
  let encouragement = mlFeedback.encouragement
  let tone = mlFeedback.tone

  if (!message) {
    if (state === "needs_review") {
      message = "This concept is worth reviewing. Let's walk through a worked example together."
    } else {
      message = "Not quite yet, but you’re close. Use the scaffolded hint to adjust your next attempt."
    }
  }

  if (!encouragement) {
    encouragement =
      state === "needs_review"
        ? "Take a moment to review the lesson material for this skill, then retry with fresh eyes."
        : "You’ve got this—apply the hint to adjust your code and run it again."
  }

  if (!tone) {
    tone = state === "needs_review" ? "supportive" : "instructive"
  }

  return {
    message,
    hint: undefined,
    workedExample: undefined,
    encouragement,
    tone,
    nextAction,
    feedbackType,
  }
}

type ContentTestDefinition = NonNullable<ContentQuestion["tests"]>[number]

function convertContentTestToDbInput(questionId: string, test: ContentTestDefinition) {
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
      throw new Error(`Missing function name for function test in question ${questionId}`)
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

  throw new Error(`Unsupported test type "${test.type}" for question ${questionId}`)
}

async function hydrateLegacyTestCases(questionId: string) {
  const contentQuestion = await getContentQuestionById(questionId)
  if (!contentQuestion?.tests || contentQuestion.tests.length === 0) {
    return []
  }

  const data = contentQuestion.tests.map((test) => convertContentTestToDbInput(questionId, test))

  try {
    await prisma.testCase.createMany({
      data,
    })
  } catch (error) {
    console.warn(`[grade] Unable to persist autogenerated tests for ${questionId}:`, error)
  }

  return prisma.testCase.findMany({
    where: { questionId },
    orderBy: { createdAt: "asc" },
  })
}

async function runRemoteGrader(payload: {
  code: string
  language: string
  testCases: Array<{ input: string; expectedOutput: string; timeoutMs?: number }>
}): Promise<{ passed: boolean; results: RawGradeResult[] }> {
  const baseUrl = (process.env.ML_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${baseUrl}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const snippet = await response.text().catch(() => "")
      throw new Error(`Grader responded with ${response.status}${snippet ? `: ${snippet}` : ""}`)
    }

    const data = await response.json()
    return {
      passed: Boolean(data?.passed),
      results: Array.isArray(data?.results) ? (data.results as RawGradeResult[]) : [],
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Grader request timed out")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeResults(testCaseCount: number, rawResults: RawGradeResult[]): RawGradeResult[] {
  const lookup = new Map<number, RawGradeResult>()
  rawResults.forEach((result, idx) => {
    const index = typeof result.index === "number" ? result.index : idx
    lookup.set(index, { ...result, index })
  })

  return Array.from({ length: testCaseCount }, (_, index) => {
    return (
      lookup.get(index) ?? {
        index,
        status: "error",
        stdout: null,
        stderr: "Missing grader output.",
      }
    )
  })
}

function buildFormattedResults(
  testCases: Array<{ hidden: boolean }>,
  rawResults: RawGradeResult[],
): FormattedTestResult[] {
  let visibleCount = 0

  return testCases.map((testCase, index) => {
    const raw = rawResults[index] ?? { index, status: "error", stdout: null, stderr: "Missing grader output." }
    const label = `Test #${++visibleCount}`
    return {
      index,
      label,
      hidden: testCase.hidden,
      status: raw.status,
      stdout: testCase.hidden ? null : raw.stdout ?? null,
      stderr: raw.stderr ?? null,
      actual: raw.actual ?? null,
      expected: raw.expected ?? null,
      inputSummary: raw.input_summary ?? null,
    }
  })
}

function buildFallbackGrading(
  testCases: Array<{ hidden: boolean }>,
  code: string,
  referenceAnswer: string | null,
): { results: RawGradeResult[]; passed: boolean } {
  const fallbackPass = referenceAnswer ? compareCode(code, referenceAnswer) : false
  const results: RawGradeResult[] = testCases.map((_, index) => {
    if (index === 0) {
      return {
        index,
        status: fallbackPass ? "pass" : "fail",
        stdout: fallbackPass ? "Matched stored reference solution." : null,
        stderr: fallbackPass ? null : "Fallback comparison failed.",
        actual: fallbackPass ? referenceAnswer ?? null : code,
        expected: referenceAnswer ?? null,
        input_summary: "reference comparison",
      }
    }
    return {
      index,
      status: "error",
      stdout: null,
      stderr: "Automated grader unavailable.",
      actual: null,
      expected: null,
      input_summary: null,
    }
  })

  return { results, passed: fallbackPass }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const { questionId, code, elapsedMs } = body

    if (!questionId || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        testCases: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    if (!question.testCases || question.testCases.length === 0) {
      const hydrated = await hydrateLegacyTestCases(questionId)
      if (hydrated.length > 0) {
        question = { ...question, testCases: hydrated }
      }
    }

    const testCases = question.testCases ?? []
    const hasAuthorTests = testCases.length > 0
    const effectiveTestCases: Array<{ hidden: boolean }> = hasAuthorTests ? testCases : [{ hidden: false }]

    let rawResults: RawGradeResult[] = []
    let formattedTests: FormattedTestResult[] = []
    let correct = false
    let gradingEngine = "python-runner"

    if (hasAuthorTests) {
      try {
        const gradeResponse = await runRemoteGrader({
          code,
          language: "python",
          testCases: testCases.map((testCase) => ({
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            timeoutMs: testCase.timeoutMs ?? 2000,
          })),
        })
        rawResults = normalizeResults(effectiveTestCases.length, gradeResponse.results ?? [])
        formattedTests = buildFormattedResults(effectiveTestCases, rawResults)
        correct = formattedTests.every((test) => (test.hidden ? true : test.status === "pass"))
      } catch (error) {
        console.error("[grade] Grader unavailable:", error)
        return NextResponse.json(
          {
            error: "Automated grader unavailable. Ensure the ML service is running on http://127.0.0.1:8000.",
          },
          { status: 503 },
        )
      }
    } else {
      gradingEngine = "reference-answer"
      const fallback = buildFallbackGrading(effectiveTestCases, code, question.answer)
      rawResults = fallback.results
      formattedTests = buildFormattedResults(effectiveTestCases, rawResults)
      correct = fallback.passed
    }

    const masteryRows = await sql`
      SELECT "pKnown"
      FROM "Mastery"
      WHERE "userId" = ${user.id} AND "skillId" = ${question.skillId}
      LIMIT 1
    `

    const previousMastery =
      masteryRows.length > 0 && masteryRows[0]?.pKnown !== null
        ? Number(masteryRows[0].pKnown)
        : null

    const previousAttempts = await sql`
      SELECT a.correct, a."elapsedMs", a."createdAt"
      FROM "Attempt" a
      JOIN "Question" q ON a."questionId" = q.id
      WHERE a."userId" = ${user.id} AND q."skillId" = ${question.skillId}
      ORDER BY a."createdAt" ASC
      LIMIT 50
    `
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    await sql`
      INSERT INTO "Attempt" ("id", "userId", "questionId", "correct", "elapsedMs", "details", "createdAt")
      VALUES (
        ${attemptId},
        ${user.id},
        ${questionId},
        ${correct},
        ${elapsedMs ?? 0},
        ${{
          engine: gradingEngine,
          passed: correct,
          results: rawResults,
        }},
        NOW()
      )
    `

    const historyAfterAttempt: AttemptEntry[] = [
      ...(previousAttempts as AttemptEntry[]),
      {
        correct,
        elapsedMs: elapsedMs ?? null,
        createdAt: new Date().toISOString(),
      },
    ]

    const previousConsecutiveIncorrect = getConsecutiveIncorrect(previousAttempts as AttemptEntry[])
    const consecutiveIncorrect = getConsecutiveIncorrect(historyAfterAttempt)
    const attemptCountForSkill = historyAfterAttempt.length
    const recentPerformance = historyAfterAttempt.slice(-5).map((entry) => entry.correct)
    const avgElapsedMs =
      historyAfterAttempt.length > 0
        ? Math.round(
            historyAfterAttempt.reduce((sum, entry) => sum + (entry.elapsedMs ?? 0), 0) /
              historyAfterAttempt.length,
          )
        : 0

    const ktResponse = await fetch(`${request.nextUrl.origin}/api/ml/kt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        skillId: question.skillId,
        questionId,
        correct,
        elapsedMs,
        attemptHistory: historyAfterAttempt,
      }),
    })

    const ktResult = await ktResponse.json()
    const fallbackBaseline = previousMastery ?? 0.35
    const mlBaseline =
      typeof ktResult.pKnown === "number" && !Number.isNaN(ktResult.pKnown) ? Number(ktResult.pKnown) : fallbackBaseline
    const baselineMastery = previousMastery ?? mlBaseline

    let pKnown = baselineMastery

    if (correct) {
      const smallGain = 0.04
      const mediumGain = 0.07
      const standardGain = 0.1

      let delta = standardGain
      if (previousConsecutiveIncorrect >= 2) {
        delta = smallGain
      } else if (previousConsecutiveIncorrect === 1) {
        delta = mediumGain
      }

      pKnown = baselineMastery + delta
    } else if (previousMastery !== null) {
      const highDrop = 0.08
      const midDrop = 0.1
      const lowDrop = 0.12

      let delta = lowDrop
      if (previousMastery >= 0.75) {
        delta = highDrop
      } else if (previousMastery >= 0.55) {
        delta = midDrop
      }

      pKnown = baselineMastery - delta
    }

    pKnown = Math.round(Math.min(Math.max(pKnown, 0.05), 0.98) * 100) / 100

    const masteryId = `mastery_${user.id}_${question.skillId}`
    await sql`
      INSERT INTO "Mastery" ("id", "userId", "skillId", "pKnown", "updatedAt")
      VALUES (${masteryId}, ${user.id}, ${question.skillId}, ${pKnown}, NOW())
      ON CONFLICT ("userId", "skillId")
      DO UPDATE SET "pKnown" = ${pKnown}, "updatedAt" = NOW()
    `

    const masteryDelta = pKnown - baselineMastery
    let mlFeedback: MlFeedback = {}

    try {
      const feedbackPayload: Record<string, unknown> = {
        userId: user.id,
        correct,
        difficulty: difficultyToNumber(question.difficulty),
        attemptCount: attemptCountForSkill,
        masteryLevel: pKnown,
        recentPerformance,
        consecutiveErrors: consecutiveIncorrect,
        masteryDelta,
      }

      feedbackPayload.avgTimeMs = avgElapsedMs > 0 ? avgElapsedMs : elapsedMs ?? 0

      const feedbackResponse = await fetch(`${request.nextUrl.origin}/api/ml/feedback-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackPayload),
      })

      if (feedbackResponse.ok) {
        mlFeedback = await feedbackResponse.json()
      }
    } catch (error) {
      console.warn("[v0] Feedback ML fallback:", (error as Error)?.message ?? error)
    }

    const pedagogicalFeedback = buildPedagogicalFeedback({
      correct,
      question: {
        skillId: question.skillId,
        difficulty: question.difficulty,
        answer: question.answer,
      },
      mastery: pKnown,
      consecutiveIncorrect,
      attemptCount: attemptCountForSkill,
      mlFeedback,
    })

    // Gate which hint tiers the UI can access based on ML recommendation (logistic-style policy).
    let allowedHintTiers: UiHintTier[] | undefined = undefined
    if (!correct) {
      const hintLevel = (mlFeedback.hintLevel as HintRecommendation | undefined) ?? "simple"
      if (hintLevel === "worked_example") {
        allowedHintTiers = ["simple", "medium", "worked_example"]
      } else if (hintLevel === "scaffold") {
        allowedHintTiers = ["simple", "medium"]
      } else {
        allowedHintTiers = ["simple"]
      }
    }

    return NextResponse.json({
      correct,
      passed: correct,
      feedback: pedagogicalFeedback.message,
      hint: pedagogicalFeedback.hint,
      workedExample: pedagogicalFeedback.workedExample,
      encouragement: pedagogicalFeedback.encouragement,
      tone: pedagogicalFeedback.tone,
      mastery: pKnown,
      nextAction: pedagogicalFeedback.nextAction,
      feedbackType: pedagogicalFeedback.feedbackType,
      skillId: question.skillId,
      consecutiveIncorrect,
      tests: formattedTests,
      allowedHintTiers,
    })
  } catch (error) {
    console.error("[v0] Error processing attempt:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
