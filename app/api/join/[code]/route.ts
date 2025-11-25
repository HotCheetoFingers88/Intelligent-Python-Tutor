import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"
import { ClassRole } from "@prisma/client"

type RouteContext = {
  params: { code: string }
}

export async function GET(_: Request, { params }: RouteContext) {
  const { code } = params
  const user = await getCurrentUser()

  const klass = await prisma.class.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      createdAt: true,
      instructor: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  })

  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  if (!user) {
    return NextResponse.json({
      requiresAuth: true,
      class: { id: klass.id, name: klass.name, instructor: klass.instructor.username },
    })
  }

  const enrollment = await prisma.enrollment.upsert({
    where: {
      classId_userId: {
        classId: klass.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      classId: klass.id,
      userId: user.id,
      role: klass.instructor.id === user.id ? ClassRole.instructor : ClassRole.student,
    },
    select: {
      role: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    joined: true,
    class: {
      id: klass.id,
      name: klass.name,
      instructor: klass.instructor.username,
      inviteCode: klass.inviteCode,
    },
    enrollment,
  })
}
