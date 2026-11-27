import { createHash, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { expect } from "@playwright/test";
import { lastMail, linkIn, PASSWORD, signUp, sql, test, uniqueEmail } from "./helpers";

async function seedInvite(email: string, role: "admin" | "moderator" | "reader") {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest();
  await sql`insert into invite (email, role, token_hash, expires_at) values (${email}, ${role}, ${hash}, now() + interval '72 hours')`;
  return token;
}

test("an invitation is accepted in the app: account, then authenticator, then the role", async ({ page }) => {
  const email = uniqueEmail("invitee");
  const token = await seedInvite(email, "reader");

  await page.goto(`/invite#${token}`);
  await expect(page.getByRole("heading", { name: "You're invited to join Astro's team" })).toBeVisible();
  // The token never stays in the address bar.
  await expect(page).toHaveURL(/\/invite$/);

  // No account yet: create one; confirming the email comes back to the invitation.
  await signUp(page, email);
  await page.goto(linkIn((await lastMail(email, /confirm/i)).text));
  await expect(page).toHaveURL(/\/invite$/);
  await expect(page.getByText("Team members must use an authenticator app")).toBeVisible();

  await page.getByRole("link", { name: "Turn on 2-step sign-in" }).click();
  await expect(page).toHaveURL(/\/account#two-step$/);
  await page.getByRole("button", { name: "Turn on 2-step sign-in" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const totp = OTPAuth.URI.parse((await page.getByTestId("totp-uri").getAttribute("data-uri")) ?? "") as OTPAuth.TOTP;
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "I've saved them" }).click();

  await page.goto("/invite");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  // A reader invite asks for the reader guidelines first, and can't be accepted until the person agrees.
  await expect(page.getByText("Readers agree to the reader guidelines")).toBeVisible();
  await expect(page.getByRole("region", { name: "Reader guidelines" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
  await page.getByLabel("I've read the reader guidelines and agree to them").check();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByRole("heading", { name: "You're on the team" })).toBeVisible();
  const [row] = await sql<{ n: number }[]>`select count(*)::int as n from reader_role r join "user" u on u.id = r.user_id where u.email = ${email} and r.revoked_at is null`;
  expect(row?.n).toBe(1);
  const [logged] = await sql<{ actor_role: string }[]>`select a.actor_role from audit_log a join "user" u on u.id = a.actor_id where u.email = ${email} and a.action = 'team.accept'`;
  expect(logged?.actor_role).toBe("reader");
});

test("an invitation can't be used a second time", async ({ page }) => {
  await page.goto(`/invite#${"A".repeat(43)}`);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  const res = await page.request.post("/api/invite/accept", { data: { token: "A".repeat(43) }, headers: { origin: new URL(page.url()).origin } });
  expect(res.status()).toBe(401);
});
