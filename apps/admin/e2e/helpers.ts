import type { BrowserContext, Page } from "@playwright/test";
import { sessionCookie } from "./seed";

let ip = 0;
/** Each test looks like its own visitor: Better Auth rate-limits sign-in per client IP. */
export async function ownIp(page: Page) {
  ip += 1;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `10.30.${Math.floor(ip / 250)}.${ip % 250}` });
}

/** Signs `userId` in to the portal by setting a session cookie made directly in the database. */
export async function signInAs(context: BrowserContext, baseURL: string | undefined, userId: string, surface: "admin" | "app" = "admin") {
  const { hostname } = new URL(baseURL ?? "http://127.0.0.1:8791");
  await context.addCookies([{ name: "astro-admin.session_token", value: await sessionCookie(userId, surface), domain: hostname, path: "/admin" }]);
}

/** Milliseconds until the next 30-second TOTP step, so a test can get a fresh code. */
export const msToNextStep = () => 30_000 - (Date.now() % 30_000) + 250;
