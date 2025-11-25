"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { LogoutButton } from "@/components/logout-button"

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be 32 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores"),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type ProfileFormsProps = {
  username: string
  email: string
  role: string
}

export function ProfileForms({ username, email, role }: ProfileFormsProps) {
  const { toast } = useToast()
  const [currentUsername, setCurrentUsername] = useState(username)

  const usernameForm = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: currentUsername },
  })

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const handleUsernameSubmit = usernameForm.handleSubmit(async (values) => {
    usernameForm.clearErrors()
    try {
      const response = await fetch("/api/profile/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 409) {
        usernameForm.setError("username", { message: "Username already taken" })
        return
      }

      if (!response.ok) {
        usernameForm.setError("username", { message: data?.error ?? "Unable to update username" })
        return
      }

      setCurrentUsername(data.username)
      usernameForm.reset({ username: data.username })
      toast({ title: "Username updated", description: "Your username has been updated successfully." })
    } catch (error) {
      usernameForm.setError("username", { message: (error as Error)?.message ?? "Something went wrong." })
    }
  })

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    passwordForm.clearErrors()
    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        passwordForm.setError("currentPassword", { message: data?.error ?? "Unable to change password" })
        return
      }

      toast({ title: "Password updated", description: "Your password has been changed." })
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      passwordForm.setError("currentPassword", { message: (error as Error)?.message ?? "Something went wrong." })
    }
  })

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Manage the details tied to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-sm text-white">{email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="text-sm text-white capitalize">{role.toLowerCase()}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Username</CardTitle>
          <CardDescription>Choose a unique username other learners will see.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...usernameForm}>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <FormField
                control={usernameForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="your_new_username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={usernameForm.formState.isSubmitting}>
                  {usernameForm.formState.isSubmitting ? "Saving..." : "Save Username"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Enter your current password to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? "Updating..." : "Change Password"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log out</CardTitle>
          <CardDescription>You can always log back in with your email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton
            variant="destructive"
            size="sm"
            className="justify-center bg-red-800 text-red-100 hover:bg-red-900 border-transparent px-8"
          >
            Log out
          </LogoutButton>
        </CardContent>
      </Card>
    </div>
  )
}
