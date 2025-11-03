import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    const skills = await sql`
      SELECT * FROM "Skill"
      ORDER BY "order" ASC
    `

    return NextResponse.json({ skills })
  } catch (error) {
    console.error("[v0] Error fetching skills:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, order } = body

    if (!name || order === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const skillId = `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await sql`
      INSERT INTO "Skill" ("id", "name", "order", "createdAt")
      VALUES (${skillId}, ${name}, ${order}, NOW())
    `

    return NextResponse.json({ success: true, id: skillId })
  } catch (error) {
    console.error("[v0] Error creating skill:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
