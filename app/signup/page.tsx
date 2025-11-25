import { redirect } from "next/navigation"
import { AppNav } from "@/components/app-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SignupForm } from "@/components/auth/signup-form"
import { getCurrentUser } from "@/lib/auth/session"

type SignupPageProps = {
  searchParams?: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
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
              <CardTitle>Create your account</CardTitle>
              <CardDescription>Choose a unique username to personalize your tutoring experience.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignupForm redirectTo={nextParam} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
