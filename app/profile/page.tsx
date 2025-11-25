import { AppNav } from "@/components/app-nav"
import { ProfileForms } from "@/components/profile/profile-forms"
import { requireUser } from "@/lib/auth/session"

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="container mx-auto px-4 py-8">
        <ProfileForms username={user.username} email={user.email} role={user.role} />
      </main>
    </div>
  )
}
