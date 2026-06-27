"use server"

import { redirect } from "next/navigation"
import { createSession } from "@/lib/auth/session"

export async function demoLogin() {
  await createSession({
    id: "cmqvs5up80000fjvolxo09dqc",
    username: "student_demo",
    email: "student@demo.com",
    role: "student",
  })
  redirect("/student/dashboard")
}
