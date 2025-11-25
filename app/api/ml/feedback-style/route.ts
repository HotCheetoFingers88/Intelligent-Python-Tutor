import { type NextRequest, NextResponse } from "next/server"

/**
 * Feedback Styling API - Proxy to Python ML Service
 *
 * This endpoint calls the Python FastAPI service that uses scikit-learn
 * for personalized feedback generation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      correct,
      difficulty = 2,
      attemptCount = 1,
      masteryLevel = 0.5,
      masteryDelta = 0,
      avgTimeMs = 60000,
      consecutiveErrors,
      recentPerformance = [],
    } = body

    if (!userId || correct === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL

    if (mlApiUrl) {
      const resolvedConsecutiveErrors =
        typeof consecutiveErrors === "number"
          ? consecutiveErrors
          : recentPerformance.filter((r: boolean) => !r).length
      try {
        const response = await fetch(`${mlApiUrl}/feedback-style`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            correct,
            difficulty,
            attempt_count: attemptCount,
            mastery_level: masteryLevel,
            mastery_delta: masteryDelta,
            recent_performance: recentPerformance.length > 0 ? recentPerformance : [correct],
            avg_time_ms: avgTimeMs,
            consecutive_errors: resolvedConsecutiveErrors,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            state: data.state,
            hintLevel: data.hint_level,
            message: data.message,
            tone: data.tone,
            encouragement: data.encouragement,
            confidence: data.confidence,
            modelVersion: "sklearn-state-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML feedback fallback:", (error as Error)?.message ?? error)
      }
    }

    // Fallback: Mock implementation mirroring the ML output contract
    let state = "steady_progress"
    let hintLevel: "simple" | "scaffold" | "worked_example" = "simple"
    let message = ""
    let tone = "neutral"
    let encouragement = ""
    const resolvedConsecutiveErrors =
      typeof consecutiveErrors === "number" ? consecutiveErrors : recentPerformance.filter((r: boolean) => !r).length

    if (!correct && (resolvedConsecutiveErrors >= 3 || masteryLevel < 0.4)) {
      state = "needs_review"
      hintLevel = "worked_example"
      message = "Let's look at a full example together and rebuild confidence."
      tone = "supportive"
      encouragement = "Study the solution carefully, then try to reimplement it."
    } else if (!correct || masteryLevel < 0.6) {
      state = "needs_scaffold"
      hintLevel = "scaffold"
      message = "You're close—let's add a structured hint to guide the next step."
      tone = "instructive"
      encouragement = "Tackle one sub-problem at a time and re-run your code."
    } else {
      state = "steady_progress"
      hintLevel = "simple"
      message = "Great momentum! Keep applying this strategy."
      tone = "celebratory"
      encouragement = "If you feel ready, take on a tougher variant next."
    }

    return NextResponse.json({
      state,
      hintLevel,
      message,
      tone,
      encouragement: encouragement || undefined,
      modelVersion: "fallback-v1",
    })
  } catch (error) {
    console.error("[v0] Error in feedback styling:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
