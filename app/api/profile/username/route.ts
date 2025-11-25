import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"

export async function PATCH(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const username = typeof (body as any)?.username === "string" ? (body as any).username.trim().toLowerCase() : ""

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
  }

  if (username === user.username.toLowerCase()) {
    return NextResponse.json({ username: user.username })
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username },
    select: { username: true },
  })

  return NextResponse.json({ username: updated.username })
}
