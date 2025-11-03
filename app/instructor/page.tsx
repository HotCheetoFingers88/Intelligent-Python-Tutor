import { AppNav } from "@/components/app-nav"
import { InstructorConsole } from "@/components/instructor-console"

export default function InstructorPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto px-4 py-8">
        <InstructorConsole />
      </main>
    </div>
  )
}
