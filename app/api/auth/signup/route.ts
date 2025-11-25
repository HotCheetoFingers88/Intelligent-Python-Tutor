import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth/password"
import { createSession } from "@/lib/auth/session"
import { ensureUniqueIdentifiers, signupSchema, UserConflictError } from "@/lib/auth/validation"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { email, username, password, role } = parsed.data
    const roleValue = role === "instructor" ? "instructor" : "student"

    const [emailUser, usernameUser] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ])

    try {
      ensureUniqueIdentifiers({ emailUser, usernameUser })
    } catch (error) {
      if (error instanceof UserConflictError) {
        return NextResponse.json({ error: error.message, field: error.field }, { status: 409 })
      }
      throw error
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: roleValue,
      },
      select: { id: true, email: true, username: true, role: true },
    })

    await createSession(user)

    return NextResponse.json({ ok: true, user })
  } catch (error) {
    console.error("[auth/signup] unexpected error", error)
    return NextResponse.json({ error: "Unable to complete signup" }, { status: 500 })
  }
}
