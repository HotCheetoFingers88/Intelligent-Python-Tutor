"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BookOpen, LayoutDashboard, Settings, User } from "lucide-react"
import type { SessionUser } from "@/lib/auth/session"

type AppNavProps = {
  user?: SessionUser | null
}

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname()
  const userRole = typeof user?.role === "string" ? user.role.toLowerCase() : undefined

  const navItems = [
    {
      title: "Dashboard",
      href: "/student/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Practice",
      href: "/student/practice",
      icon: BookOpen,
    },
  ]

  if (userRole === "instructor") {
    navItems.push({
      title: "Instructor Console",
      href: "/instructor",
      icon: Settings,
    })
  }

  return (
    <nav className="sticky top-0 z-50 glass-strong border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-xl font-bold text-accent transition-all group-hover:text-white">
              {"{"}ascend.py{"}"}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all backdrop-blur-sm",
                    isActive
                      ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                      : "text-muted-foreground hover:bg-white/5 hover:text-accent border border-transparent hover:border-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.title}</span>
                </Link>
              )
            })}

            {user && (
              <Link
                href="/profile"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all backdrop-blur-sm",
                  pathname === "/profile"
                    ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-accent border border-transparent hover:border-white/10",
                )}
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
