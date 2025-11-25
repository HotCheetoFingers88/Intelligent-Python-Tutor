import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      class: {
        select: { id: true, name: true, inviteCode: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    classes: enrollments.map((enrollment) => ({
      id: enrollment.class.id,
      name: enrollment.class.name,
      inviteCode: enrollment.class.inviteCode,
      createdAt: enrollment.class.createdAt,
      role: enrollment.role,
    })),
  })
}
