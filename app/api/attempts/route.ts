import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

type AttemptEntry = {
  correct: boolean
  elapsedMs: number | null
  createdAt: string
}

type MlFeedback = {
  message?: string
  hint?: string
  encouragement?: string
  tone?: string
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

function getHint(skillId: string, stage: number): string {
  const library = hintLibrary[skillId] || {
    initial: "Think about the key concept behind this question and break it down.",
    scaffold: "Focus on the first step—what needs to happen before the rest?",
    review: "Review the related lesson material, then re-implement the solution slowly.",
  }

  if (stage <= 1) return library.initial
  if (stage === 2) return library.scaffold
  return library.review
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

function buildPedagogicalFeedback({
  correct,
  question,
  mastery,
  consecutiveIncorrect,
  attemptCount,
  mlFeedback,
}: {
  correct: boolean
  question: { skillId: string; difficulty: number; answer: string | null }
  mastery: number
  consecutiveIncorrect: number
  attemptCount: number
  mlFeedback: MlFeedback
}) {
  const nextAction = correct ? "advance" : consecutiveIncorrect >= 2 ? "focus_skill" : "retry"
  const feedbackType = correct
    ? "praise"
    : consecutiveIncorrect >= 3
      ? "review"
      : consecutiveIncorrect >= 2
        ? "worked_example"
        : "hint"

  if (correct) {
    return {
      message: "Great job! You're ready for the next challenge.",
      hint: undefined,
      workedExample: undefined,
      encouragement:
        mastery >= 0.8
          ? "Take on a harder challenge or explore the next concept."
          : "Keep the momentum going—you're building mastery.",
      tone: "celebratory",
      nextAction,
      feedbackType,
    }
  }

  const stage = Math.max(1, consecutiveIncorrect) // ensure at least 1
  const hintStage = stage > 1 ? 1 : stage
  const hint = stage === 1 && mlFeedback.hint ? mlFeedback.hint : getHint(question.skillId, hintStage)

  let message = mlFeedback.message
  let encouragement = mlFeedback.encouragement
  let workedExample: string | undefined

  if (!message) {
    if (stage === 1) {
      message = "Not quite yet, but you’re close. Try focusing on the key concept highlighted in the hint."
    } else if (stage === 2) {
      message = "We're almost there. Let's walk through a worked example together."
    } else {
      message =
        "This concept is worth reviewing. Revisit the fundamentals, then apply them to this problem when you're ready."
    }
  }

  if (!encouragement) {
    encouragement =
      stage >= 3
        ? "Take a moment to review the lesson material for this skill, then retry with fresh eyes."
        : "You’ve got this—use the hint to adjust your code and run it again."
  }

  if (stage >= 2 && question.answer) {
    workedExample = question.answer
  }

  return {
    message,
    hint,
    workedExample,
    encouragement,
    tone: mlFeedback.tone || (stage >= 2 ? "instructive" : "supportive"),
    nextAction,
    feedbackType,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, questionId, answer, elapsedMs } = body

    if (!userId || !questionId || !answer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const questions = await sql`
      SELECT q.*, s.id as "skillId"
      FROM "Question" q
      JOIN "Skill" s ON q."skillId" = s.id
      WHERE q.id = ${questionId}
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const question = questions[0]

    const masteryRows = await sql`
      SELECT "pKnown"
      FROM "Mastery"
      WHERE "userId" = ${userId} AND "skillId" = ${question.skillId}
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
      WHERE a."userId" = ${userId} AND q."skillId" = ${question.skillId}
      ORDER BY a."createdAt" ASC
      LIMIT 50
    `

    const correct = compareCode(answer, question.answer)

    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    await sql`
      INSERT INTO "Attempt" ("id", "userId", "questionId", "correct", "elapsedMs", "createdAt")
      VALUES (${attemptId}, ${userId}, ${questionId}, ${correct}, ${elapsedMs ?? 0}, NOW())
    `

    const historyAfterAttempt: AttemptEntry[] = [
      ...(previousAttempts as AttemptEntry[]),
      {
        correct,
        elapsedMs: elapsedMs ?? null,
        createdAt: new Date().toISOString(),
      },
    ]

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
        userId,
        skillId: question.skillId,
        questionId,
        correct,
        elapsedMs,
        attemptHistory: historyAfterAttempt,
      }),
    })

    const ktResult = await ktResponse.json()
    let pKnown = typeof ktResult.pKnown === "number" ? ktResult.pKnown : undefined

    if (pKnown === undefined) {
      // Fallback knowledge tracing if service unavailable
      const incorrectRatio =
        historyAfterAttempt.length > 0
          ? historyAfterAttempt.filter((entry) => !entry.correct).length / historyAfterAttempt.length
          : 0.5
      pKnown = correct ? Math.max(0.35, 1 - incorrectRatio * 0.6) : Math.max(0.1, 1 - incorrectRatio * 0.8)

      if (correct && consecutiveIncorrect >= 2) {
        pKnown = Math.max(pKnown, 0.85)
      } else if (!correct && consecutiveIncorrect >= 2) {
        pKnown = Math.min(pKnown, 0.4)
      }
    }

    if (pKnown === undefined || Number.isNaN(pKnown)) {
      pKnown = previousMastery ?? 0.35
    }

    if (previousMastery !== null && !Number.isNaN(previousMastery)) {
      const prev = previousMastery
      if (correct) {
        const maxRise = prev < 0.4 ? 0.12 : prev < 0.6 ? 0.1 : 0.07
        pKnown = Math.min(Math.max(prev, pKnown), prev + maxRise)
      } else {
        const maxDrop = prev < 0.4 ? 0.18 : 0.14
        const lowerBound = prev - maxDrop
        const upperBound = prev - 0.02
        const desired = Math.min(prev, pKnown)
        pKnown = Math.max(lowerBound, Math.min(desired, upperBound))
      }
    }

    pKnown = Math.round(Math.min(Math.max(pKnown, 0.05), 0.98) * 100) / 100

    const masteryId = `mastery_${userId}_${question.skillId}`
    await sql`
      INSERT INTO "Mastery" ("id", "userId", "skillId", "pKnown", "updatedAt")
      VALUES (${masteryId}, ${userId}, ${question.skillId}, ${pKnown}, NOW())
      ON CONFLICT ("userId", "skillId")
      DO UPDATE SET "pKnown" = ${pKnown}, "updatedAt" = NOW()
    `

    let mlFeedback: MlFeedback = {}

    try {
      const feedbackPayload: Record<string, unknown> = {
        userId,
        correct,
        difficulty: question.difficulty,
        attemptCount: attemptCountForSkill,
        masteryLevel: pKnown,
        recentPerformance,
      }

      if (avgElapsedMs > 0) {
        feedbackPayload.avgTimeMs = avgElapsedMs
      }

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

    return NextResponse.json({
      correct,
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
    })
  } catch (error) {
    console.error("[v0] Error processing attempt:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
