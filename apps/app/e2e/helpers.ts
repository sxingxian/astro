import { test as base, expect, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
export const PASSWORD = "correct horse battery staple";

/** The newest email sent to `to` through the outbox driver. */
export async function lastMail(to: string, subject?: RegExp) {
  for (let i = 0; i < 40; i++) {
    const rows = await sql<{ subject: string; text: string }[]>`select subject, text from mail_outbox where "to" = ${to} order by created_at desc limit 5`;
    const hit = rows.find((r) => !subject || subject.test(r.subject));
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no mail to ${to}`);
}

export const linkIn = (text: string) => {
  const m = /(https?:\/\/\S+)/.exec(text);
  if (!m?.[1]) throw new Error("no link in mail");
  return m[1];
};

export async function signUp(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create a free account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

/** Signs up and confirms the email; ends signed in on /today. */
export async function signUpVerified(page: Page, email: string, password = PASSWORD) {
  await signUp(page, email, password);
  const mail = await lastMail(email, /confirm/i);
  await page.goto(linkIn(mail.text));
  await expect(page).toHaveURL(/\/today/);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

/**
 * Each test (and each extra browser context) looks like its own visitor, so Better Auth's per-IP limits
 * (3 sign-ups or sign-ins per 10 s) apply per test, as they would per person. Only local wrangler dev
 * lets a client set cf-connecting-ip; in production Cloudflare overwrites it.
 */
export const test = base.extend({
  // Playwright requires the empty object pattern for a fixture with no dependencies.
  // eslint-disable-next-line no-empty-pattern
  extraHTTPHeaders: async ({}, use) => {
    await use({ "cf-connecting-ip": randomIp() });
  }
});

export async function newVisitor(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomIp() } });
}

/** Picks a card from the fan by keyboard: focusing a card turns the fan to show it, Enter picks it. */
export async function pickCard(page: Page, n: number, total: number) {
  await page.getByRole("button", { name: `Card ${n} of ${total}` }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: `Card ${n} of ${total}` })).toHaveAttribute("aria-pressed", "true");
}

/** The active owner's id, creating an owner account if this test database has none. Invites and offers need a sender who may still grant. */
export async function ownerId(): Promise<string> {
  const [o] = await sql<{ user_id: string }[]>`select user_id from staff_role where role = 'owner' and revoked_at is null`;
  if (o) return o.user_id;
  const id = crypto.randomUUID();
  await sql`insert into "user" (id, name, email, email_verified) values (${id}, 'Owner', ${uniqueEmail("owner")}, true)`;
  await sql`insert into staff_role (user_id, role) values (${id}, 'owner')`;
  return id;
}
