import { AppNav } from "@/components/app-nav"
import { PracticeInterface } from "@/components/practice-interface"

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto px-4 py-8">
        <PracticeInterface />
      </main>
    </div>
  )
}
