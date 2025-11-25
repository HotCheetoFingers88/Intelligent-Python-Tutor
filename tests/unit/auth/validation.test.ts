import { ensureUniqueIdentifiers, UserConflictError } from "@/lib/auth/validation"

describe("ensureUniqueIdentifiers", () => {
  it("does nothing when both identifiers are available", () => {
    expect(() => ensureUniqueIdentifiers({})).not.toThrow()
  })

  it("throws a UserConflictError for duplicate emails", () => {
    expect(() =>
      ensureUniqueIdentifiers({
        emailUser: { id: "existing-email" },
      }),
    ).toThrowError(new UserConflictError("email", "Email already registered"))
  })

  it("throws a UserConflictError for duplicate usernames", () => {
    expect(() =>
      ensureUniqueIdentifiers({
        usernameUser: { id: "existing-username" },
      }),
    ).toThrowError(new UserConflictError("username", "Username already taken"))
  })
})
