import { AppNav } from "@/components/app-nav"
import { DashboardView } from "@/components/dashboard-view"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="container mx-auto px-4 py-8">
        <DashboardView />
      </main>
    </div>
  )
}
