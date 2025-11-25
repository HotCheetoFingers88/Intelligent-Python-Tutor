"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/auth/validation"
import { useRouter } from "next/navigation"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

type LoginFormProps = {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrUsername: "",
      password: "",
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setServerError(data?.error ?? "Invalid credentials")
        return
      }

      const userRole =
        typeof data?.user?.role === "string" ? data.user.role.toLowerCase() : "student"
      const destination =
        redirectTo ?? (userRole === "instructor" ? "/instructor" : "/student/dashboard?welcome=back")

      router.push(destination)
      router.refresh()
    } catch (error) {
      setServerError((error as Error)?.message ?? "Unable to log in.")
    }
  })

  return (
    <div className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="emailOrUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or Username</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com or your username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full bg-white text-blue-900 hover:bg-white/90"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Signing in..." : "Log In"}
          </Button>
        </form>
      </Form>
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
