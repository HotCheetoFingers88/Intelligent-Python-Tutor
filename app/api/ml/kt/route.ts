import { type NextRequest, NextResponse } from "next/server"

/**
 * Knowledge Tracing API - Proxy to Python ML Service
 *
 * This endpoint calls the Python FastAPI service that uses pyBKT
 * for Bayesian Knowledge Tracing to estimate student mastery.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, skillId, questionId, correct, elapsedMs, attemptHistory = [] } = body

    if (!userId || !skillId || !questionId || correct === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL

    if (mlApiUrl) {
      // Format attempts for pyBKT
      const attempts = [
        ...attemptHistory.map((a: any) => ({
          skill_id: a.skillId || skillId,
          correct: a.correct,
          elapsed_ms: a.elapsedMs || 0,
          ts: a.timestamp || new Date().toISOString(),
        })),
        {
          skill_id: skillId,
          correct,
          elapsed_ms: elapsedMs,
          ts: new Date().toISOString(),
        },
      ]

      try {
        const response = await fetch(`${mlApiUrl}/kt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            attempts,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          // Find mastery for this specific skill
          const skillMastery = data.mastery.find((m: any) => m.skill_id === skillId)
          return NextResponse.json({
            pKnown: skillMastery?.p_known || 0.5,
            confidence: 0.9,
            modelVersion: "pyBKT-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML KT fallback:", (error as Error)?.message ?? error)
      }
    }

    // Fallback: Mock implementation if ML service is unavailable
    const historyEntries = (attemptHistory as Array<{ correct: boolean }>).map((entry) => ({
      correct: Boolean(entry.correct),
    }))

    const totalAttempts = historyEntries.length > 0 ? historyEntries.length : 1
    const incorrectAttempts = historyEntries.filter((entry) => !entry.correct).length
    const incorrectRatio = incorrectAttempts / totalAttempts

    let consecutiveIncorrect = 0
    for (const entry of historyEntries) {
      if (entry.correct) {
        consecutiveIncorrect = 0
      } else {
        consecutiveIncorrect += 1
      }
    }

    let pKnown = 1 - incorrectRatio * 0.7

    if (correct) {
      pKnown = Math.min(0.95, Math.max(pKnown, 0.65 + (1 - incorrectRatio) * 0.25))
      if (consecutiveIncorrect >= 2) {
        pKnown = Math.max(pKnown, 0.85)
      }
    } else {
      pKnown = Math.max(0.2, pKnown - 0.25 - consecutiveIncorrect * 0.05)
    }

    if (elapsedMs && elapsedMs < 30000 && correct) {
      pKnown = Math.min(0.98, pKnown + 0.03)
    }

    return NextResponse.json({
      pKnown: Math.round(pKnown * 100) / 100,
      confidence: 0.85,
      modelVersion: "fallback-v1",
    })
  } catch (error) {
    console.error("[v0] Error in knowledge tracing:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
