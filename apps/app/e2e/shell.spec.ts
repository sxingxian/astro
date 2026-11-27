import { expect } from "@playwright/test";
import { signUpVerified, test, uniqueEmail } from "./helpers";

test("serves the app with a strict CSP and security headers, and no inline scripts", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  const res = await page.goto("/today");
  expect(res?.status()).toBeLessThan(400);
  const headers = res?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";
  // The pages are pre-built files with no inline scripts, so scripts come only from this site (and Turnstile).
  expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com;");
  expect(csp).not.toContain("unsafe-inline' https://challenges");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  const inline = await page.$$eval("script", (els) => els.filter((s) => !s.src).length);
  expect(inline).toBe(0);

  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("refuses state changes from another origin", async ({ request }) => {
  const res = await request.post("/api/reading/x/note", { data: { text: "hi" }, headers: { Origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("accepts state changes from its own origin (then asks who is signed in)", async ({ request, baseURL }) => {
  const res = await request.post("/api/reading/x/note", { data: { text: "hi" }, headers: { Origin: baseURL ?? "" } });
  expect(res.status()).toBe(401);
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
