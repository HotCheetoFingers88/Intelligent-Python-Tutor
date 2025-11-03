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
    const { userId, correct, difficulty = 1, attemptCount = 1, masteryLevel = 0.5, recentPerformance = [] } = body

    if (!userId || correct === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL

    if (mlApiUrl) {
      // Calculate metrics for ML model
      const avgTimeMs = 60000 // Default 1 minute
      const consecutiveErrors = recentPerformance.filter((r: boolean) => !r).length

      try {
        const response = await fetch(`${mlApiUrl}/feedback-style`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            correct,
            recent_performance: recentPerformance.length > 0 ? recentPerformance : [correct],
            avg_time_ms: avgTimeMs,
            consecutive_errors: consecutiveErrors,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            message: data.message,
            hint: data.style === "hint" ? data.message : undefined,
            tone: data.style === "hint" ? "encouraging" : "instructive",
            encouragement: data.style === "worked_example" ? "Take your time to understand each step." : undefined,
            modelVersion: "sklearn-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML feedback fallback:", (error as Error)?.message ?? error)
      }
    }

    // Fallback: Mock implementation
    let message = ""
    let hint = ""
    let tone = "neutral"
    let encouragement = ""

    if (correct) {
      if (masteryLevel >= 0.8) {
        message = "Excellent work! You've mastered this concept."
        tone = "celebratory"
        encouragement = "You're ready for more advanced challenges!"
      } else if (masteryLevel >= 0.6) {
        message = "Great job! Your understanding is improving."
        tone = "encouraging"
        encouragement = "Keep practicing to solidify your skills."
      } else {
        message = "Well done! You're making progress."
        tone = "supportive"
        encouragement = "Continue practicing to build confidence."
      }

      if (difficulty >= 3) {
        message += " That was a challenging problem!"
      }
    } else {
      if (attemptCount === 1) {
        message = "Not quite right, but that's okay! Learning involves making mistakes."
        tone = "supportive"
        hint = "Review the problem carefully and think about the core concept being tested."
      } else if (attemptCount === 2) {
        message = "Still not correct, but you're working through it. Let's break it down."
        tone = "instructive"
        hint = "Try approaching the problem step by step. What is the first thing you need to do?"
      } else {
        message = "This is a tricky one! Let's focus on understanding the fundamentals."
        tone = "patient"
        hint = "Consider reviewing the lesson material for this skill before trying again."
      }

      if (difficulty === 1) {
        encouragement = "You can do this! Take your time and think it through."
      } else if (difficulty === 2) {
        encouragement = "This requires careful thinking. Break the problem into smaller parts."
      } else {
        encouragement = "This is an advanced problem. Don't be discouraged - it's meant to challenge you!"
      }
    }

    return NextResponse.json({
      message,
      hint: hint || undefined,
      tone,
      encouragement: encouragement || undefined,
      modelVersion: "fallback-v1",
    })
  } catch (error) {
    console.error("[v0] Error in feedback styling:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
