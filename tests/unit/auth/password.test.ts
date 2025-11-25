import { hashPassword, verifyPassword } from "@/lib/auth/password"

describe("password helpers", () => {
  it("hashes and verifies a password", async () => {
    const password = "super-secure-password"
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(hash).toMatch(/^\$2[aby]\$/)
    const isValid = await verifyPassword(password, hash)
    expect(isValid).toBe(true)
  })

  it("fails verification with an incorrect password", async () => {
    const hash = await hashPassword("correct-password")
    const isValid = await verifyPassword("wrong-password", hash)
    expect(isValid).toBe(false)
  })
})
