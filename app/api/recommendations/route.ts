import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { RecommendationWithSkill } from "@/lib/types"
import { getCurrentUser } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = user.id

    // Get mastery data with skill information
    const masteryData = await sql`
      SELECT m.*, s.name as "skillName", s."order"
      FROM "Mastery" m
      JOIN "Skill" s ON m."skillId" = s.id
      WHERE m."userId" = ${userId}
      ORDER BY s."order" ASC
    `

    if (masteryData.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    const mlResponse = await fetch(`${request.nextUrl.origin}/api/ml/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        masteryData: masteryData.map((m: any) => ({
          skillId: m.skillId,
          skillName: m.skillName,
          pKnown: m.pKnown,
          order: m.order,
        })),
      }),
    })

    const mlResult = await mlResponse.json()
    const mlRecommendations = mlResult.recommendations || []

    // Clear old recommendations
    await sql`
      DELETE FROM "Recommendation"
      WHERE "userId" = ${userId}
    `

    // Insert new recommendations from ML API
    for (const rec of mlRecommendations) {
      const recId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await sql`
        INSERT INTO "Recommendation" ("id", "userId", "skillId", "rationale", "createdAt")
        VALUES (${recId}, ${userId}, ${rec.skillId}, ${rec.rationale}, NOW())
      `
    }

    // Fetch the recommendations with skill data
    const recommendations = await sql`
      SELECT r.*, s.name as "skillName", s."order" as "skillOrder", s."createdAt" as "skillCreatedAt"
      FROM "Recommendation" r
      JOIN "Skill" s ON r."skillId" = s.id
      WHERE r."userId" = ${userId}
      ORDER BY r."createdAt" DESC
    `

    const formattedRecommendations: RecommendationWithSkill[] = recommendations.map((rec: any) => ({
      id: rec.id,
      userId: rec.userId,
      skillId: rec.skillId,
      rationale: rec.rationale,
      createdAt: new Date(rec.createdAt),
      skill: {
        id: rec.skillId,
        name: rec.skillName,
        order: rec.skillOrder,
        createdAt: new Date(rec.skillCreatedAt),
      },
    }))

    return NextResponse.json({ recommendations: formattedRecommendations })
  } catch (error) {
    console.error("[v0] Error fetching recommendations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
