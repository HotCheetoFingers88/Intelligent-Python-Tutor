import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SignJWT, jwtVerify } from "jose"
import { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const SESSION_COOKIE = "ascend_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

type SessionPayload = {
  sub: string
  username: string
  email: string
  role: Role
}

export type SessionUser = {
  id: string
  username: string
  email: string
  role: Role
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set")
  }

  return new TextEncoder().encode(secret)
}

async function encodeSession(user: SessionUser) {
  return new SignJWT({
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

async function decodeSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    return {
      sub: String(payload.sub),
      username: String(payload.username),
      email: String(payload.email),
      role: payload.role as Role,
    }
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser) {
  const token = await encodeSession(user)
  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(SESSION_COOKIE)
  if (!cookie?.value) {
    return null
  }

  const payload = await decodeSession(cookie.value)
  if (!payload?.sub) {
    return null
  }

  return {
    id: payload.sub,
    username: payload.username,
    email: payload.email,
    role: payload.role,
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSessionUser()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, email: true, role: true },
  })

  if (!user) {
    return null
  }

  return user
}

export async function requireUser(redirectTo = "/login") {
  const user = await getCurrentUser()
  if (!user) {
    redirect(redirectTo)
  }
  return user
}
