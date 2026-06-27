"use client"

import Link from "next/link"
import { demoLogin } from "@/lib/auth/demo-login"

type LoginFormProps = {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  return (
    <div className="space-y-6">
      <form action={demoLogin} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Email or Username</label>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="student@example.com"
            name="emailOrUsername"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="password123"
            name="password"
          />
        </div>
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center rounded-md bg-white text-blue-900 hover:bg-white/90 h-10 px-4 py-2 text-sm font-medium"
        >
          Log In
        </button>
      </form>
      <p className="text-sm text-muted-foreground text-center">
        Don&apos;t have an account?{" "}
        <Link
          href={redirectTo ? `/signup?next=${encodeURIComponent(redirectTo)}` : "/signup"}
          className="text-accent hover:underline font-medium"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
