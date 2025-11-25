"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupSchema, type SignupInput } from "@/lib/auth/validation"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type SignupFormProps = {
  redirectTo?: string
}

export function SignupForm({ redirectTo }: SignupFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      role: "student",
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (response.status === 409 && data?.field) {
        form.setError(data.field, { type: "manual", message: data.error })
        return
      }

      if (!response.ok) {
        setServerError(data?.error ?? "Unable to sign up right now.")
        return
      }

      const userRole =
        typeof data?.user?.role === "string" ? data.user.role.toLowerCase() : "student"
      const destination =
        redirectTo ?? (userRole === "instructor" ? "/instructor" : "/student/dashboard?welcome=new")
      router.push(destination)
      router.refresh()
    } catch (error) {
      setServerError((error as Error)?.message ?? "Something went wrong.")
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="choose a unique username" {...field} />
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
                  <Input type="password" placeholder="minimum 8 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-2 gap-2"
                  >
                    {[
                      { value: "student", label: "Student", description: "Practice and track mastery." },
                      { value: "instructor", label: "Instructor", description: "Manage skills and questions." },
                    ].map((option) => (
                      <div key={option.value}>
                        <RadioGroupItem value={option.value} id={`role-${option.value}`} className="sr-only" />
                        <label
                          htmlFor={`role-${option.value}`}
                          className={cn(
                            "block cursor-pointer rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                            field.value === option.value
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30",
                          )}
                        >
                          <div>{option.label}</div>
                          <div className="text-xs text-muted-foreground/80">{option.description}</div>
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
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
            {form.formState.isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </Form>
      <p className="text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : "/login"}
          className="text-accent hover:underline font-medium"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
