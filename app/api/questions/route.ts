import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const questions = await sql`
      SELECT q.*, s.name as "skillName"
      FROM "Question" q
      JOIN "Skill" s ON q."skillId" = s.id
      ORDER BY s."order" ASC, q."difficulty" ASC
    `

    return NextResponse.json({ questions })
  } catch (error) {
    console.error("[v0] Error fetching questions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, starter, answer, difficulty, skillId } = body

    if (!prompt || difficulty === undefined || !skillId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await sql`
      INSERT INTO "Question" ("id", "prompt", "starter", "answer", "difficulty", "skillId", "createdAt")
      VALUES (${questionId}, ${prompt}, ${starter}, ${answer}, ${difficulty}, ${skillId}, NOW())
    `

    return NextResponse.json({ success: true, id: questionId })
  } catch (error) {
    console.error("[v0] Error creating question:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
