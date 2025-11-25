import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      skillMastery,
      consecutiveIncorrect = 0,
      consecutiveCorrect = 0,
      rollingAccuracy = 0,
      baselineDifficulty = "medium",
      lastCorrect = true,
      avgTimeMs = 60000,
    } = body

    if (skillMastery === undefined) {
      return NextResponse.json({ error: "skillMastery is required" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL
    if (mlApiUrl) {
      try {
        const response = await fetch(`${mlApiUrl}/adaptive-difficulty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_mastery: skillMastery,
            consecutive_incorrect: consecutiveIncorrect,
            consecutive_correct: consecutiveCorrect,
            rolling_accuracy: rollingAccuracy,
            baseline_difficulty: baselineDifficulty,
            last_correct: lastCorrect,
            avg_time_ms: avgTimeMs,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({ difficulty: data.difficulty, confidence: data.confidence, modelVersion: "adaptive-difficulty-v1" })
        }
      } catch (error) {
        console.warn("[v0] Adaptive difficulty proxy fallback:", (error as Error)?.message ?? error)
      }
    }

    const fallbackDifficulty = skillMastery < 0.45 || consecutiveIncorrect >= 2 ? "easy" : skillMastery > 0.75 ? "hard" : "medium"
    return NextResponse.json({ difficulty: fallbackDifficulty, confidence: 0.4, modelVersion: "adaptive-difficulty-fallback" })
  } catch (error) {
    console.error("[v0] Error in adaptive difficulty proxy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
