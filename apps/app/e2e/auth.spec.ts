import { expect } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { lastMail, linkIn, newVisitor, PASSWORD, signIn, signUp, signUpVerified, test, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

const totpFrom = (uri: string) => OTPAuth.URI.parse(uri) as OTPAuth.TOTP;

test("email must be confirmed before the first sign-in", async ({ page }) => {
  const email = uniqueEmail("verify");
  await signUp(page, email);
  await signIn(page, email);
  await expect(page.getByText("Check your email to confirm your account")).toBeVisible();
  const session = await page.request.get("/api/auth/get-session");
  expect(await session.json()).toBeNull();

  const mail = await lastMail(email, /confirm/i);
  await page.goto(linkIn(mail.text));
  await expect(page).toHaveURL(/\/today/);
});

test("a duplicate sign-up looks exactly like a new one", async ({ page }) => {
  const email = uniqueEmail("dupe");
  await signUpVerified(page, email);
  await page.context().clearCookies();
  await signUp(page, email);
  // The owner gets a heads-up instead of a confirmation link.
  const mail = await lastMail(email, /already/i);
  expect(mail.subject).toMatch(/already/i);
});

test("password reset answers the same for unknown emails", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("2-step sign-in with TOTP and single-use backup codes", async ({ page, browser }) => {
  const email = uniqueEmail("totp");
  await signUpVerified(page, email);

  await page.goto("/account");
  await page.getByRole("button", { name: "Turn on 2-step sign-in" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("totp-uri")).toBeVisible();
  const uri = await page.getByTestId("totp-uri").getAttribute("data-uri");
  expect(uri).toMatch(/^otpauth:\/\/totp\//);
  const totp = totpFrom(uri ?? "");
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("backup-code")).toHaveCount(10);
  const codes = await page.getByTestId("backup-code").allTextContents();
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText("2-step sign-in is on")).toBeVisible();

  // Sign out, sign in: a code is required, a wrong one fails.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-step/);
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /didn't match/i })).toBeVisible();
  await page.getByLabel("6-digit code").fill(totp.generate({ timestamp: Date.now() + 30_000 }));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/today/);

  // A backup code works once.
  const fresh = await newVisitor(browser);
  const p2 = await fresh.newPage();
  await signIn(p2, email);
  await p2.getByRole("button", { name: "Use a backup code" }).click();
  await p2.getByLabel("Backup code").fill(codes[0] ?? "");
  await p2.getByRole("button", { name: "Verify" }).click();
  await expect(p2).toHaveURL(/\/today/);
  await p2.context().clearCookies();
  await signIn(p2, email);
  await p2.getByRole("button", { name: "Use a backup code" }).click();
  await p2.getByLabel("Backup code").fill(codes[0] ?? "");
  await p2.getByRole("button", { name: "Verify" }).click();
  await expect(p2.getByRole("alert").filter({ hasText: /used already/i })).toBeVisible();
  await fresh.close();

  // Turning 2-step off needs the password and signs out every other device.
  const other = await newVisitor(browser);
  const p3 = await other.newPage();
  await signIn(p3, email);
  await p3.getByRole("button", { name: "Use a backup code" }).click();
  await p3.getByLabel("Backup code").fill(codes[1] ?? "");
  await p3.getByRole("button", { name: "Verify" }).click();
  await expect(p3).toHaveURL(/\/today/);

  await page.goto("/account");
  await page.getByRole("button", { name: "Turn off 2-step sign-in" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText("2-step sign-in is off")).toBeVisible();
  const after = await p3.request.get("/api/auth/get-session");
  expect(await after.json()).toBeNull();
  await other.close();
});

test("resetting the password signs out every other device", async ({ page, browser }) => {
  const email = uniqueEmail("reset");
  await signUpVerified(page, email);
  const other = await newVisitor(browser);
  const p2 = await other.newPage();
  await signIn(p2, email);
  await expect(p2).toHaveURL(/\/today/);

  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const mail = await lastMail(email, /reset/i);
  await page.goto(linkIn(mail.text));
  await page.getByLabel("New password").fill("a brand new long passphrase");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  const after = await p2.request.get("/api/auth/get-session");
  expect(await after.json()).toBeNull();
  await other.close();
});
