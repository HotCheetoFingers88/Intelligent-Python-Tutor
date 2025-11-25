import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/auth/password"
import { createSession, clearSession } from "@/lib/auth/session"
import { loginSchema } from "@/lib/auth/validation"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { emailOrUsername, password } = parsed.data

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
      select: { id: true, email: true, username: true, role: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const validPassword = await verifyPassword(password, user.passwordHash)

    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await createSession({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    })

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, username: user.username, role: user.role } })
  } catch (error) {
    console.error("[auth/login] unexpected error", error)
    await clearSession()
    return NextResponse.json({ error: "Unable to log in" }, { status: 500 })
  }
}
