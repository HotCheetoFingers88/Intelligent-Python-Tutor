import { type NextRequest, NextResponse } from "next/server"

type QuestionInput = {
  questionId: string
  skillId: string
  difficulty: "easy" | "medium" | "hard" | number
  avgTimeMs?: number
  incorrectAttempts?: number
  masteryGain?: number
  solvedRate?: number
  responseEntropy?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const questions = (body?.questions ?? []) as QuestionInput[]

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "questions must be a non-empty array" }, { status: 400 })
    }

    const mlApiUrl = process.env.ML_API_URL
    if (mlApiUrl) {
      try {
        const response = await fetch(`${mlApiUrl}/question-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions: questions.map((question) => ({
              questionId: question.questionId,
              skillId: question.skillId,
              difficulty: question.difficulty,
              avgTimeMs: question.avgTimeMs ?? 60000,
              incorrectAttempts: question.incorrectAttempts ?? 0,
              avgMasteryGain: question.masteryGain ?? 0.05,
              solvedRate: question.solvedRate ?? 0.5,
              responseEntropy: question.responseEntropy ?? 0.8,
            })),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          return NextResponse.json({
            assignments: data.assignments ?? [],
            clusters: data.clusters ?? [],
            modelVersion: "question-clusters-v1",
          })
        }
      } catch (error) {
        console.warn("[v0] ML question grouping fallback:", (error as Error)?.message ?? error)
      }
    }

    const fallbackAssignments = questions.map((question) => ({
      question_id: question.questionId,
      cluster_id: 0,
      label: "default",
    }))

    return NextResponse.json({
      assignments: fallbackAssignments,
      clusters: [],
      modelVersion: "question-clusters-fallback",
    })
  } catch (error) {
    console.error("[v0] Error in question groups proxy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
