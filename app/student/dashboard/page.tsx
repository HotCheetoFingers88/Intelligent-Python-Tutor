import { AppNav } from "@/components/app-nav"
import { DashboardView } from "@/components/dashboard-view"
import { getSessionUser, createSession } from "@/lib/auth/session"
import { cookies } from "next/headers"

const DEMO_USER = {
  id: "cmqvs5up80000fjvolxo09dqc",
  username: "student_demo",
  email: "student@demo.com",
  role: "student" as const,
}

type DashboardPageProps = {
  searchParams?: {
    welcome?: string
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  let user = await getSessionUser()

  if (!user) {
    await createSession(DEMO_USER)
    user = DEMO_USER
  }

  const resolvedParams = await searchParams
  const welcomeParam = resolvedParams?.welcome

  const welcomeMessage =
    welcomeParam === "new"
      ? `Welcome, ${user.username}`
      : welcomeParam === "back"
        ? `Welcome back, ${user.username}`
        : undefined

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8">
        <DashboardView welcomeMessage={welcomeMessage} username={user.username} />
      </main>
    </div>
  )
}
