import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { QuestionWithSkill } from "@/lib/types"

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const desiredSkillId = searchParams.get("skillId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
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
    for (const attempt of recentAttempts as Array<{ skillId: string; correct: boolean }>) {
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
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions available", targetSkillId }, { status: 404 })
    }

    const ranked = (questions as any[]).sort((a, b) => {
      const aDelta = Math.abs(Number(a.difficulty ?? 2) - targetDifficulty)
      const bDelta = Math.abs(Number(b.difficulty ?? 2) - targetDifficulty)
      if (aDelta !== bDelta) {
        return aDelta - bDelta
      }

      const aResolved = normalizeBoolean(a.hasCorrect)
      const bResolved = normalizeBoolean(b.hasCorrect)

      if (aResolved !== bResolved) {
        return aResolved ? 1 : -1 // Prefer unsolved questions
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

      return a.difficulty - b.difficulty
    })

    const questionData = ranked[0]
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
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching next question:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
