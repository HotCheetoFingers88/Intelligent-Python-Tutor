import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { MasteryWithSkill } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Get all skills first
    const skills = await sql`
      SELECT * FROM "Skill"
      ORDER BY "order" ASC
    `

    // Get mastery data for the user
    const masteryData = await sql`
      SELECT m.*, s.name as "skillName", s."order" as "skillOrder", s."createdAt" as "skillCreatedAt"
      FROM "Mastery" m
      JOIN "Skill" s ON m."skillId" = s.id
      WHERE m."userId" = ${userId}
      ORDER BY s."order" ASC
    `

    // Create mastery records for all skills (with 0 for skills not yet practiced)
    const mastery: MasteryWithSkill[] = skills.map((skill: any) => {
      const existingMastery = masteryData.find((m: any) => m.skillId === skill.id)

      if (existingMastery) {
        return {
          id: existingMastery.id,
          userId: existingMastery.userId,
          skillId: existingMastery.skillId,
          pKnown: existingMastery.pKnown,
          updatedAt: new Date(existingMastery.updatedAt),
          skill: {
            id: skill.id,
            name: skill.name,
            order: skill.order,
            createdAt: new Date(skill.createdAt),
          },
        }
      }

      // Return placeholder for unpracticed skills
      return {
        id: `placeholder_${skill.id}`,
        userId,
        skillId: skill.id,
        pKnown: 0,
        updatedAt: new Date(),
        skill: {
          id: skill.id,
          name: skill.name,
          order: skill.order,
          createdAt: new Date(skill.createdAt),
        },
      }
    })

    return NextResponse.json({ mastery })
  } catch (error) {
    console.error("[v0] Error fetching mastery:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
