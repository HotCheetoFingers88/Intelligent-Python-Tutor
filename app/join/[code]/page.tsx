import Link from "next/link"
import { notFound } from "next/navigation"
import { AppNav } from "@/components/app-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { ClassRole } from "@prisma/client"

type JoinPageProps = {
  params: { code: string }
  searchParams?: { next?: string }
}

export default async function JoinClassPage({ params }: JoinPageProps) {
  const user = await getCurrentUser()
  const klass = await prisma.class.findUnique({
    where: { inviteCode: params.code },
    include: {
      instructor: { select: { username: true } },
    },
  })

  if (!klass) {
    notFound()
  }

  if (user) {
    await prisma.enrollment.upsert({
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
        role: klass.instructorId === user.id ? ClassRole.instructor : ClassRole.student,
      },
    })
  }

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle>{klass.name}</CardTitle>
            <CardDescription>Instructor: {klass.instructor.username}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You&apos;re now enrolled in <span className="text-foreground font-medium">{klass.name}</span>.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/student/practice?classId=${klass.id}`}>Go to class practice</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/student/practice">Continue personal practice</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/student/dashboard">View dashboard</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to join this class. You&apos;ll be redirected back here afterward.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/login?next=/join/${klass.inviteCode}`}>Log in to join</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/signup?next=/join/${klass.inviteCode}`}>Create account</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
