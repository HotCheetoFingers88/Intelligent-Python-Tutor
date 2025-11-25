import { test, expect } from "@playwright/test"

test("signup, logout, and login flow", async ({ page }) => {
  const unique = Date.now()
  const username = `learner_${unique}`
  const email = `${username}@example.com`
  const password = "password1234"

  await page.goto("/")

  await page.getByRole("link", { name: /sign up/i }).first().click()
  await expect(page).toHaveURL(/\/signup$/)

  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /create account/i }).click()

  await expect(page).toHaveURL(/student\/dashboard/)
  await expect(page.getByTestId("welcome-banner")).toContainText(`Welcome, ${username}`)

  await page.getByRole("button", { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel("Email or Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /log in/i }).click()

  await expect(page).toHaveURL(/student\/dashboard/)
  await expect(page.getByTestId("welcome-banner")).toContainText(`Welcome back, ${username}`)
})
