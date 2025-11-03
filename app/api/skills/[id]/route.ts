import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, order } = body

    if (!name || order === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await sql`
      UPDATE "Skill"
      SET "name" = ${name}, "order" = ${order}
      WHERE "id" = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating skill:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Delete associated questions first
    await sql`
      DELETE FROM "Question"
      WHERE "skillId" = ${id}
    `

    // Delete the skill
    await sql`
      DELETE FROM "Skill"
      WHERE "id" = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting skill:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
