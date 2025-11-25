import { type NextRequest, NextResponse } from "next/server"

type DifficultySample = {
  questionId: string
  baseDifficulty: "easy" | "medium" | "hard"
  avgTimeMs: number
  incorrectAttempts: number
  hasCorrect: boolean
  masteryLevel: number
  consecutiveIncorrect: number
  skillAttempts: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const samples = (body?.samples ?? []) as DifficultySample[]

    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ error: "samples must be a non-empty array" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL
    if (mlApiUrl) {
      try {
        const response = await fetch(`${mlApiUrl}/difficulty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            samples: samples.map((sample) => ({
              question_id: sample.questionId,
              base_difficulty: sample.baseDifficulty,
              avg_time_ms: sample.avgTimeMs,
              incorrect_attempts: sample.incorrectAttempts,
              has_correct: sample.hasCorrect,
              mastery_level: sample.masteryLevel,
              consecutive_incorrect: sample.consecutiveIncorrect,
              skill_attempts: sample.skillAttempts,
            })),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            predictions: data.predictions ?? [],
            modelVersion: "difficulty-gb-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML difficulty fallback:", (error as Error)?.message ?? error)
      }
    }

    const fallbackPredictions = samples.map((sample) => {
      const score =
        (sample.baseDifficulty === "hard" ? 2 : sample.baseDifficulty === "medium" ? 1 : 0) +
        Math.max(sample.incorrectAttempts, sample.consecutiveIncorrect)
      if (score >= 4) {
        return { question_id: sample.questionId, difficulty: "hard", confidence: 0.5 }
      }
      if (score >= 2) {
        return { question_id: sample.questionId, difficulty: "medium", confidence: 0.5 }
      }
      return { question_id: sample.questionId, difficulty: "easy", confidence: 0.5 }
    })

    return NextResponse.json({
      predictions: fallbackPredictions,
      modelVersion: "difficulty-fallback",
    })
  } catch (error) {
    console.error("[v0] Error in difficulty proxy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
