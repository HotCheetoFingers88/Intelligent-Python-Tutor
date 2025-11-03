import { type NextRequest, NextResponse } from "next/server"

/**
 * Recommendations API - Proxy to Python ML Service
 *
 * This endpoint calls the Python FastAPI service that uses scikit-learn
 * for collaborative filtering recommendations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, masteryData = [] } = body

    if (!userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (masteryData.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    const mlApiUrl = process.env.ML_API_URL

    if (mlApiUrl) {
      try {
        const response = await fetch(`${mlApiUrl}/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            mastery_data: masteryData.map((m: any) => ({
              skill_id: m.skillId,
              p_known: m.pKnown,
            })),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            recommendations: [
              {
                skillId: data.skill_id,
                skillName: data.skill_id,
                rationale: data.rationale,
                priority: 10,
                recommendationType: "ml_collaborative_filtering",
              },
            ],
            modelVersion: "surprise-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML recommend fallback:", (error as Error)?.message ?? error)
      }
    }

    // Fallback: Rule-based recommendations
    const sortedSkills = [...masteryData].sort((a, b) => {
      if (Math.abs(a.pKnown - b.pKnown) > 0.1) {
        return a.pKnown - b.pKnown
      }
      return a.order - b.order
    })

    const recommendations = []
    const weakestSkills = sortedSkills.filter((s) => s.pKnown < 0.6).slice(0, 2)

    for (const skill of weakestSkills) {
      let rationale = ""
      let priority = 0

      if (skill.pKnown < 0.3) {
        rationale = `You're just getting started with ${skill.skillName}. Building a strong foundation here will help you progress faster.`
        priority = 10
      } else if (skill.pKnown < 0.5) {
        rationale = `You have some understanding of ${skill.skillName}, but more practice will help solidify these concepts.`
        priority = 8
      } else {
        rationale = `You're making good progress with ${skill.skillName}. A few more practice sessions will help you achieve mastery.`
        priority = 6
      }

      recommendations.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        rationale,
        priority,
        recommendationType: "strengthen_weakness",
      })
    }

    const topRecommendations = recommendations.sort((a, b) => b.priority - a.priority).slice(0, 3)

    return NextResponse.json({
      recommendations: topRecommendations,
      modelVersion: "fallback-v1",
    })
  } catch (error) {
    console.error("[v0] Error in recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
