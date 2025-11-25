import { redirect } from "next/navigation"
import { AppNav } from "@/components/app-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { getCurrentUser } from "@/lib/auth/session"

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser()
  if (user) {
    redirect("/student/dashboard")
  }

  const resolvedParams = searchParams ? await searchParams : undefined
  const nextParam = resolvedParams?.next

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md">
          <Card className="glass-strong border-white/10">
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>Sign in with your email or username and password to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm redirectTo={nextParam} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
