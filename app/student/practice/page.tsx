import { AppNav } from "@/components/app-nav"
import { PracticeInterface } from "@/components/practice-interface"
import { requireUser } from "@/lib/auth/session"

type PracticePageProps = {
  searchParams?: Promise<{ classId?: string }>
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const user = await requireUser()
  const resolvedParams = searchParams ? await searchParams : undefined
  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8">
        <PracticeInterface initialClassId={resolvedParams?.classId ?? undefined} />
      </main>
    </div>
  )
}
