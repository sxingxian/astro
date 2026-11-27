import { expect } from "@playwright/test";
import { signUpVerified, test, uniqueEmail } from "./helpers";

test("serves the app with a nonce CSP and security headers", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  const headers = res?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scriptNonces = await page.$$eval("script", (els) => els.map((s) => s.nonce || s.getAttribute("nonce") || ""));
  expect(scriptNonces.length).toBeGreaterThan(0);
  for (const n of scriptNonces) expect(n).toBe(nonce);

  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("refuses state changes from another origin", async ({ request }) => {
  const res = await request.post("/api/health", { headers: { Origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("accepts state changes from its own origin", async ({ request, baseURL }) => {
  const res = await request.post("/api/health", { headers: { Origin: baseURL ?? "" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test.describe("app layout", () => {
  test("desktop shows the side menu; phones show the bottom tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/today");
    const menu = page.getByRole("navigation", { name: "Main menu" });
    await expect(menu).toBeVisible();
    for (const name of ["Today", "Ask", "Journal", "Patterns", "Account"]) await expect(menu.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "App" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/today");
    const tabs = page.getByRole("navigation", { name: "App" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveText(["Today", "Ask", "Journal", "Account"]);
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("Ask is coming soon: guests are asked to create an account", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ask");
    await expect(page.getByRole("heading", { name: "Bring one question. Choose AI or a real reader." })).toBeVisible();
    await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Ask" })).toHaveAttribute("aria-current", "page");
  });
});

test("Ask tells signed-in people they'll hear when it opens", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("ask"));
  await page.goto("/ask");
  await expect(page.getByText("We'll let you know when it opens.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a free account" })).toHaveCount(0);
});
