import { z } from "zod"

export const signupSchema = z.object({
  email: z
    .string()
    .email("Please provide a valid email")
    .max(255)
    .transform((value) => value.trim().toLowerCase()),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be 32 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores")
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  role: z.enum(["student", "instructor"]).default("student"),
})

export const loginSchema = z.object({
  emailOrUsername: z
    .string()
    .min(1, "Email or username is required")
    .max(255)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

export class UserConflictError extends Error {
  constructor(public field: "email" | "username", message: string) {
    super(message)
    this.name = "UserConflictError"
  }
}

export function ensureUniqueIdentifiers({
  emailUser,
  usernameUser,
}: {
  emailUser?: unknown | null
  usernameUser?: unknown | null
}) {
  if (emailUser) {
    throw new UserConflictError("email", "Email already registered")
  }
  if (usernameUser) {
    throw new UserConflictError("username", "Username already taken")
  }
}
