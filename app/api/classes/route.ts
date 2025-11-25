import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"
import { ClassRole } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role.toLowerCase() !== "instructor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const classes = await prisma.class.findMany({
    where: { instructorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { enrollments: true, questions: true },
      },
    },
  })

  return NextResponse.json({
    classes: classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      inviteCode: klass.inviteCode,
      createdAt: klass.createdAt,
      enrollmentCount: klass._count.enrollments,
      questionCount: klass._count.questions,
    })),
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role.toLowerCase() !== "instructor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const inviteCode = nanoid(10)

  const klass = await prisma.class.create({
    data: {
      name,
      inviteCode,
      instructorId: user.id,
    },
  })

  await prisma.enrollment.upsert({
    where: {
      classId_userId: {
        classId: klass.id,
        userId: user.id,
      },
    },
    update: { role: ClassRole.instructor },
    create: {
      classId: klass.id,
      userId: user.id,
      role: ClassRole.instructor,
    },
  })

  return NextResponse.json({
    class: {
      id: klass.id,
      name: klass.name,
      inviteCode: klass.inviteCode,
      createdAt: klass.createdAt,
    },
  })
}
