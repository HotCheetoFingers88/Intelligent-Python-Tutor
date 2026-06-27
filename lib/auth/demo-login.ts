"use server"

import { redirect } from "next/navigation"
import { createSession } from "@/lib/auth/session"

export async function demoLogin() {
  await createSession({
    id: "user_student_seed",
    username: "student",
    email: "student@example.com",
    role: "student",
  })
  redirect("/student/dashboard")
}
