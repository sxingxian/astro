import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { PASSWORD, seedPerson } from "./seed";
import { signInAs } from "./helpers";

// Better Auth rate-limits sign-in per client IP; give each test its own, as Cloudflare would.
let ip = 0;
test.beforeEach(async ({ page }) => {
  ip += 1;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `10.20.${Math.floor(ip / 250)}.${ip % 250}` });
});

const WRONG = "That email or password isn't right.";
// Next adds its own hidden route announcer with role="alert", so look for the form's message.
const formAlert = (page: Page) => page.locator("form [role=alert]");

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("someone without a portal role gets the same message as a wrong password", async ({ page }) => {
  const plain = await seedPerson({ email: `plain-${Date.now()}@example.com` });
  const reader = await seedPerson({ email: `reader-${Date.now()}@example.com`, role: "reader", twoStep: true });
  const staff = await seedPerson({ email: `wrong-${Date.now()}@example.com`, role: "moderator" });
  for (const email of [plain.email, reader.email]) {
    await signIn(page, email);
    await expect(formAlert(page)).toHaveText(WRONG);
  }
  await signIn(page, staff.email, "not the password at all");
  await expect(formAlert(page)).toHaveText(WRONG);
});

test("a disabled staff member can't sign in", async ({ page }) => {
  const s = await seedPerson({ email: `disabled-${Date.now()}@example.com`, role: "moderator", twoStep: true, disabled: true });
  await signIn(page, s.email);
  await expect(formAlert(page)).toHaveText(WRONG);
});

test("staff without an authenticator must set one up before anything else", async ({ page }) => {
  const s = await seedPerson({ email: `setup-${Date.now()}@example.com`, role: "admin" });
  await signIn(page, s.email);
  await expect(page).toHaveURL(/\/admin\/setup-2fa$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/setup-2fa$/);

  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const uri = await page.getByTestId("totp-uri").getAttribute("data-uri");
  const totp = OTPAuth.URI.parse(uri ?? "") as OTPAuth.TOTP;
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("backup-code").first()).toBeVisible();
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("staff with an authenticator sign in with a code and see their menu", async ({ page }) => {
  const s = await seedPerson({ email: `mod-${Date.now()}@example.com`, role: "moderator", twoStep: true });
  await signIn(page, s.email);
  await expect(page).toHaveURL(/\/admin\/two-step$/);
  await page.getByLabel("6-digit code").fill(s.totp!.generate());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const menu = page.getByRole("navigation", { name: "Admin" });
  await expect(menu.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "AI settings" })).toHaveCount(0);
  await expect(page.getByText(s.email)).toBeVisible();
});

test("an app session cookie never opens the portal", async ({ page, context, baseURL }) => {
  const s = await seedPerson({ email: `crossover-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, s.id, "app");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test("signing out ends the session", async ({ page, context, baseURL }) => {
  const s = await seedPerson({ email: `out-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, s.id);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test("the portal never signs anyone in from an email link (that would skip the code)", async ({ page }) => {
  for (const path of ["/admin/api/auth/verify-email?token=x", "/admin/api/auth/magic-link/verify?token=x"]) {
    expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});
