import { expect, type Page } from "@playwright/test";
import { pickCard, signUpVerified, test, uniqueEmail } from "./helpers";

// Stage 2: moving between screens keeps the app in the page, so the frame never disappears and nothing goes blank.

/** Marks the page; the mark survives only if no full page load happens. */
const mark = (page: Page) => page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
const kept = (page: Page) => page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true);

test("tapping the tabs opens each screen in place, with the tabs on screen the whole time and one session call", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpVerified(page, uniqueEmail("nav"));
  const sessions: string[] = [];
  page.on("request", (r) => new URL(r.url()).pathname === "/api/session" && sessions.push(r.url()));
  await page.goto("/today");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await mark(page);

  const tabs = page.getByRole("navigation", { name: "App" });
  for (const [name, heading, url] of [["Journal", "Journal", /\/journal$/], ["Account", "Account", /\/account$/], ["Ask", /Bring one question/, /\/ask$/], ["Today", null, /\/today$/]] as const) {
    await tabs.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(tabs).toBeVisible();
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(tabs.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
  }
  expect(await kept(page)).toBe(true);
  expect(sessions).toHaveLength(1);

  // A filter change re-reads the list in place.
  await tabs.getByRole("link", { name: "Journal", exact: true }).click();
  await page.getByRole("link", { name: "One card", exact: true }).click();
  await expect(page).toHaveURL(/filter=one/);
  await expect(page.getByRole("link", { name: "One card", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await kept(page)).toBe(true);
});

test("after a draw, the reading opens in place; its back arrow returns to Today", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signUpVerified(page, uniqueEmail("navdraw"));
  await page.goto("/today");
  await mark(page);
  await page.getByRole("link", { name: "Draw today's card" }).click();
  await expect(page).toHaveURL(/\/draw\/one/);
  await pickCard(page, 12, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  expect(await kept(page)).toBe(true);

  const bar = page.getByRole("banner");
  await expect(bar.getByText("Your reading")).toBeVisible();
  await bar.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/(today|draw\/one)$/);
  expect(await kept(page)).toBe(true);
});

test("every phone screen has a top bar: the logo on main screens, back and a name on deeper ones", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/journal/patterns");
  await page.goto("/ask");
  const bar = page.getByRole("banner");
  await expect(bar.getByRole("link", { name: "Astro" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/terms");
  await expect(bar.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/today");
  await expect(bar.getByText("Terms of use")).toBeVisible();

  await page.goto("/no-such-screen");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "App" })).toBeVisible();
});

test("on desktop every screen's content starts at the same place", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signUpVerified(page, uniqueEmail("edge"));
  const edges: Record<string, number> = {};
  for (const path of ["/today", "/journal", "/journal/patterns", "/account", "/ask", "/terms"]) {
    await page.goto(path);
    const box = await page.locator("main [data-page]:not([aria-busy])").first().boundingBox();
    edges[path] = Math.round(box?.x ?? -1);
  }
  expect(new Set(Object.values(edges)), JSON.stringify(edges)).toEqual(new Set([edges["/today"]]));
});

test("the skip link still jumps to the content", async ({ page }) => {
  await page.goto("/ask");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
