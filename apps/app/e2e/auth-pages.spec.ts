import { expect } from "@playwright/test";
import { PASSWORD, signUpVerified, sql, test, uniqueEmail } from "./helpers";

test("after creating an account, the page shows only the 'Check your email' view", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(uniqueEmail("one-heading"));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create a free account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Create your free account")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Astro" })).toHaveCount(1);
});

test("sign-up asks for the password twice and sends nothing until they match", async ({ page }) => {
  const email = uniqueEmail("mismatch");
  let posted = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/sign-up/email")) posted = true;
  });
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(`${PASSWORD}x`);
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create a free account" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toHaveAttribute("aria-invalid", "true");
  expect(posted).toBe(false);
  expect((await sql`select 1 from "user" where email = ${email}`).length).toBe(0);

  await page.getByLabel("Confirm password").fill(PASSWORD);
  await expect(page.getByText("The passwords don't match.")).toHaveCount(0);
  await page.getByRole("button", { name: "Create a free account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("forgot password also ends on a single 'Check your email' view", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(uniqueEmail("forgot-one"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByText("Reset your password")).toHaveCount(0);
});

test("changing the password in Account asks for the new one twice", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("change-twice"));
  await page.goto("/account");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("a different long passphrase");
  await page.getByLabel("Confirm new password").fill("a different long passphrase!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
});
