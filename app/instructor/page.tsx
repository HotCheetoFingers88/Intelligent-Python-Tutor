import { redirect } from "next/navigation"
import { AppNav } from "@/components/app-nav"
import { InstructorConsole } from "@/components/instructor-console"
import { requireUser } from "@/lib/auth/session"

export default async function InstructorPage() {
  const user = await requireUser()

  const isInstructor = user.role.toLowerCase() === "instructor"

  if (!isInstructor) {
    redirect("/student/dashboard")
  }

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8">
        <InstructorConsole />
      </main>
    </div>
  )
}
