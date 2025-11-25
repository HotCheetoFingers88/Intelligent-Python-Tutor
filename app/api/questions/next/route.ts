import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { QuestionWithSkill } from "@/lib/types"
import { prisma } from "@/lib/prisma"
import { GLOBAL_CLASS_ID } from "@/lib/constants"
import { getCurrentUser } from "@/lib/auth/session"

interface SkillScore {
  skillId: string
  mastery: number
  accuracy: number
  combined: number
  consecutiveIncorrect: number
  consecutiveCorrect: number
}

function normalizeBoolean(value: any): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") return value === "t" || value === "true" || value === "1"
  return false
}

function difficultyWeight(value: string | number | null | undefined) {
  if (value === "easy" || value === 1) return 1
  if (value === "hard" || value === 3) return 3
  return 2
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const desiredSkillId = searchParams.get("skillId")
    const requestedClassId = searchParams.get("classId")
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const classId =
      requestedClassId && requestedClassId !== "all" ? requestedClassId : GLOBAL_CLASS_ID

    if (classId !== GLOBAL_CLASS_ID) {
      const hasAccess = await prisma.class.findFirst({
        where: {
          id: classId,
          OR: [
            { instructorId: userId },
            { enrollments: { some: { userId } } },
          ],
        },
        select: { id: true },
      })

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const useMl = (process.env.USE_ML || "").toLowerCase() === "true"

    // Load baseline student model data
    const masteryData = await sql`
      SELECT "skillId", "pKnown"
      FROM "Mastery"
      WHERE "userId" = ${userId}
    `

    const accuracyData = await sql`
      SELECT 
        q."skillId",
        COUNT(*) as total_attempts,
        SUM(CASE WHEN a.correct THEN 1 ELSE 0 END) as correct_count
      FROM "Attempt" a
      JOIN "Question" q ON a."questionId" = q.id
      WHERE a."userId" = ${userId}
      GROUP BY q."skillId"
    `

    const recentAttempts = await sql`
      SELECT q."skillId", a.correct, a."createdAt"
      FROM "Attempt" a
      JOIN "Question" q ON a."questionId" = q.id
      WHERE a."userId" = ${userId}
      ORDER BY a."createdAt" ASC
    `
    const recentAttemptsArray = recentAttempts as Array<{ skillId: string; correct: boolean }>

    const baselineMastery: Record<string, number> = {
      skill_variables: 0.92,
      skill_conditionals: 0.3,
      skill_loops: 0.55,
      skill_functions: 0.8,
      skill_lists: 0.7,
    }

    const masteryMap = new Map(masteryData.map((m: any) => [m.skillId, Number(m.pKnown)]))
    const accuracyMap = new Map(
      accuracyData.map((a: any) => [
        a.skillId,
        {
          total: Number(a.total_attempts),
          correct: Number(a.correct_count),
          accuracy: Number(a.correct_count) / Math.max(1, Number(a.total_attempts)),
        },
      ]),
    )

    const incorrectStreakMap = new Map<string, number>()
    const correctStreakMap = new Map<string, number>()
    for (const attempt of recentAttemptsArray) {
      const incorrectCurrent = incorrectStreakMap.get(attempt.skillId) ?? 0
      const correctCurrent = correctStreakMap.get(attempt.skillId) ?? 0
      if (attempt.correct) {
        incorrectStreakMap.set(attempt.skillId, 0)
        correctStreakMap.set(attempt.skillId, correctCurrent + 1)
      } else {
        incorrectStreakMap.set(attempt.skillId, incorrectCurrent + 1)
        correctStreakMap.set(attempt.skillId, 0)
      }
    }

    const recentTwo = await sql`
      SELECT q."skillId", a.correct
      FROM "Attempt" a
      JOIN "Question" q ON a."questionId" = q.id
      WHERE a."userId" = ${userId}
      ORDER BY a."createdAt" DESC
      LIMIT 2
    `
    let recentRepeatSkill: string | null = null
    if (recentTwo.length === 2) {
      if (!recentTwo[0].correct && !recentTwo[1].correct) {
        recentRepeatSkill = recentTwo[0].skillId
      }
    }

    const skills = await sql`
      SELECT * FROM "Skill"
      ORDER BY "order" ASC
    `

    if (skills.length === 0) {
      return NextResponse.json({ error: "No skills configured" }, { status: 404 })
    }

    const skillScores: SkillScore[] = skills.map((skill: any) => {
      const mastery = masteryMap.has(skill.id)
        ? (masteryMap.get(skill.id) as number)
        : baselineMastery[skill.id] ?? 0.65
      const accuracyObj = accuracyMap.get(skill.id)
      const accuracy = accuracyObj?.accuracy ?? 0
      const combined = mastery * 0.7 + accuracy * 0.3
      const consecutiveIncorrect = incorrectStreakMap.get(skill.id) ?? 0
      const consecutiveCorrect = correctStreakMap.get(skill.id) ?? 0
      return {
        skillId: skill.id,
        mastery,
        accuracy,
        combined,
        consecutiveIncorrect,
        consecutiveCorrect,
      }
    })

    let targetSkillId = skillScores.reduce((prev, curr) => (curr.combined < prev.combined ? curr : prev)).skillId
    let selectionReason: string = "lowest_mastery"

    if (recentRepeatSkill) {
      targetSkillId = recentRepeatSkill
      selectionReason = "repeat_until_mastered"
    }

    const strugglingSkill = skillScores
      .filter((s) => s.consecutiveIncorrect >= 2)
      .sort((a, b) => b.consecutiveIncorrect - a.consecutiveIncorrect)[0]

    if (!recentRepeatSkill && strugglingSkill) {
      targetSkillId = strugglingSkill.skillId
      selectionReason = "repeat_until_mastered"
    } else if (!recentRepeatSkill && desiredSkillId && skillScores.some((s) => s.skillId === desiredSkillId)) {
      targetSkillId = desiredSkillId
      selectionReason = "requested_focus"
    }

    const mlCanRecommend = selectionReason === "lowest_mastery"

    // ML-assisted recommendation (Case 3)
    if (mlCanRecommend && useMl && masteryData.length > 0) {
      try {
        const mlResponse = await fetch(`${request.nextUrl.origin}/api/ml/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            masteryData: masteryData.map((m: any) => ({
              skillId: m.skillId,
              skillName: skills.find((s: any) => s.id === m.skillId)?.name ?? m.skillId,
              pKnown: Number(m.pKnown),
              order: skills.find((s: any) => s.id === m.skillId)?.order ?? 0,
            })),
          }),
        })

        if (mlResponse.ok) {
          const mlData = await mlResponse.json()
          const mlSkillId = mlData?.recommendations?.[0]?.skillId
          if (mlSkillId && skillScores.some((s) => s.skillId === mlSkillId)) {
            targetSkillId = mlSkillId
            selectionReason = "ml_recommendation"
          }
        }
      } catch (error) {
        console.warn("[v0] ML recommendation fallback triggered:", error)
      }
    }

    // Fetch questions for the selected skill with attempt context for prioritisation
    const selectedSkillScore = skillScores.find((s) => s.skillId === targetSkillId)
    let targetDifficulty = 2
    if (selectedSkillScore) {
      if (selectedSkillScore.mastery < 0.45) {
        targetDifficulty = 1
      } else if (selectedSkillScore.mastery >= 0.75) {
        targetDifficulty = 3
      } else {
        targetDifficulty = 2
      }

      if (selectedSkillScore.consecutiveIncorrect >= 2) {
        targetDifficulty = Math.max(1, targetDifficulty - 1)
      } else if (selectedSkillScore.consecutiveCorrect >= 3) {
        targetDifficulty = Math.min(3, targetDifficulty + 1)
      }
    }

    const adaptiveDifficultyEnabled = useMl

    let adaptiveDifficulty: "easy" | "medium" | "hard" | null = null
    if (adaptiveDifficultyEnabled && selectedSkillScore) {
      try {
        const lastSkillAttempt = [...recentAttemptsArray].reverse().find((attempt) => attempt.skillId === targetSkillId)
        const lastCorrect = lastSkillAttempt ? normalizeBoolean(lastSkillAttempt.correct) : true
        const response = await fetch(`${request.nextUrl.origin}/api/ml/adaptive-difficulty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillMastery: selectedSkillScore.mastery,
            consecutiveIncorrect: selectedSkillScore.consecutiveIncorrect,
            consecutiveCorrect: selectedSkillScore.consecutiveCorrect,
            rollingAccuracy: selectedSkillScore.accuracy,
            baselineDifficulty: targetDifficulty === 1 ? "easy" : targetDifficulty === 3 ? "hard" : "medium",
            lastCorrect,
            avgTimeMs: 60000,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          if (data?.difficulty === "easy") targetDifficulty = 1
          else if (data?.difficulty === "hard") targetDifficulty = 3
          else targetDifficulty = 2
          adaptiveDifficulty = data?.difficulty ?? null
        }
      } catch (error) {
        console.warn("[v0] Adaptive difficulty fallback:", (error as Error)?.message ?? error)
      }
    }

    const questions = await sql`
      SELECT 
        q.*,
        s.name as "skillName",
        s."order" as "skillOrder",
        EXISTS (
          SELECT 1 FROM "Attempt" a
          WHERE a."questionId" = q.id AND a."userId" = ${userId} AND a.correct = true
        ) as "hasCorrect",
        (
          SELECT COUNT(*) FROM "Attempt" a
          WHERE a."questionId" = q.id AND a."userId" = ${userId} AND a.correct = false
        ) as "incorrectAttempts",
        (
          SELECT MAX(a."createdAt") FROM "Attempt" a
          WHERE a."questionId" = q.id AND a."userId" = ${userId}
        ) as "lastAttemptAt"
      FROM "Question" q
      JOIN "Skill" s ON q."skillId" = s.id
      WHERE q."skillId" = ${targetSkillId}
        AND q."classId" = ${classId}
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions available", targetSkillId }, { status: 404 })
    }

    const unsolved = (questions as any[]).filter((question) => !normalizeBoolean(question.hasCorrect))
    const questionPool = unsolved.length > 0 ? unsolved : (questions as any[])

    const ranked = questionPool.sort((a, b) => {
      const aDifficultyWeight = difficultyWeight(a.difficulty)
      const bDifficultyWeight = difficultyWeight(b.difficulty)
      const aDelta = Math.abs(aDifficultyWeight - targetDifficulty)
      const bDelta = Math.abs(bDifficultyWeight - targetDifficulty)
      if (aDelta !== bDelta) {
        return aDelta - bDelta
      }

      const aIncorrect = Number(a.incorrectAttempts ?? 0)
      const bIncorrect = Number(b.incorrectAttempts ?? 0)
      if (aIncorrect !== bIncorrect) {
        return bIncorrect - aIncorrect // Prefer questions with more incorrect attempts
      }

      const aLast = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0
      const bLast = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0
      if (aLast !== bLast) {
        return aLast - bLast // Prefer older attempts
      }

      return aDifficultyWeight - bDifficultyWeight
    })

    const questionData = ranked[0]
    let predictedDifficulty: string | null = null
    let difficultyConfidence: number | null = null

    try {
      const baseDifficulty =
        typeof questionData.difficulty === "number"
          ? questionData.difficulty === 1
            ? "easy"
            : questionData.difficulty === 3
              ? "hard"
              : "medium"
          : (questionData.difficulty as "easy" | "medium" | "hard")
      const baseWeight = difficultyWeight(questionData.difficulty)
      const avgTimeEstimate = baseWeight === 1 ? 45000 : baseWeight === 2 ? 70000 : 105000
      const diffResponse = await fetch(`${request.nextUrl.origin}/api/ml/difficulty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samples: [
            {
              questionId: questionData.id,
              baseDifficulty,
              avgTimeMs: avgTimeEstimate,
              incorrectAttempts: Number(questionData.incorrectAttempts ?? 0),
              hasCorrect: normalizeBoolean(questionData.hasCorrect),
              masteryLevel: masteryMap.get(questionData.skillId) ?? baselineMastery[questionData.skillId] ?? 0.6,
              consecutiveIncorrect: selectedSkillScore?.consecutiveIncorrect ?? 0,
              skillAttempts: Number(accuracyMap.get(questionData.skillId)?.total ?? 0),
            },
          ],
        }),
      })

      if (diffResponse.ok) {
        const diffData = await diffResponse.json()
        const prediction = diffData?.predictions?.[0]
        if (prediction?.difficulty) {
          predictedDifficulty = prediction.difficulty
          difficultyConfidence = typeof prediction.confidence === "number" ? prediction.confidence : null
        }
      }
    } catch (error) {
      console.warn("[v0] Difficulty ML fallback:", (error as Error)?.message ?? error)
    }
    const question: QuestionWithSkill = {
      id: questionData.id,
      prompt: questionData.prompt,
      starter: questionData.starter,
      answer: questionData.answer,
      difficulty: questionData.difficulty,
      skillId: questionData.skillId,
      createdAt: new Date(questionData.createdAt),
      skill: {
        id: questionData.skillId,
        name: questionData.skillName,
        order: questionData.skillOrder,
        createdAt: new Date(questionData.createdAt),
      },
    }

    return NextResponse.json({
      question,
      meta: {
        targetSkillId,
        selectionReason,
        mastery: masteryMap.get(questionData.skillId) ?? baselineMastery[questionData.skillId] ?? 0,
        pKnown: masteryMap.get(questionData.skillId) ?? baselineMastery[questionData.skillId] ?? 0,
        consecutiveIncorrect: incorrectStreakMap.get(questionData.skillId) ?? 0,
        totalAttempts: Number(accuracyMap.get(questionData.skillId)?.total ?? 0),
        difficulty: questionData.difficulty,
        predictedDifficulty,
        difficultyConfidence,
        adaptiveDifficulty,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching next question:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
