import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"
import { verifyPassword, hashPassword } from "@/lib/auth/password"

export async function PATCH(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : ""

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All password fields are required" }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })

  if (!existing?.passwordHash) {
    return NextResponse.json({ error: "User password is not set" }, { status: 400 })
  }

  const isValid = await verifyPassword(currentPassword, existing.passwordHash)
  if (!isValid) {
    return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return NextResponse.json({ ok: true })
}
