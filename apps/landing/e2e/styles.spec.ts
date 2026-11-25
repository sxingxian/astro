import { expect, test } from "@playwright/test";

const MUTED = "rgb(140, 136, 166)";
const HAZE = "rgb(185, 180, 207)";
const GOLD = "rgb(216, 180, 106)";

test.describe("utility classes win over component defaults", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("links take their own colours", async ({ page }) => {
    await page.goto("/");
    const rail = page.getByRole("navigation", { name: "Chapters" }).getByRole("link");
    await expect(rail.nth(1)).toHaveCSS("color", MUTED);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCSS("color", HAZE);
  });

  test("the featured tier is outlined in gold", async ({ page }) => {
    await page.goto("/");
    const featured = page.locator("#deeper a.border-gold");
    await expect(featured).toHaveCount(1);
    await expect(featured).toHaveCSS("border-top-color", GOLD);
  });

  test("the closing headline uses its own size", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#h-final")).toHaveCSS("font-size", "84px");
  });

  test("main has no focus ring after the skip link", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect(page.locator("main")).toHaveCSS("outline-style", "none");
  });
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 360, height: 780 }, reducedMotion: "reduce" });

  test("the header does not overlap the hero card", async ({ page }) => {
    await page.goto("/");
    const header = await page.locator("header").boundingBox();
    const card = await page.locator('[data-anim="hero-card"]').first().boundingBox();
    expect(header && card).toBeTruthy();
    expect(header!.y + header!.height).toBeLessThanOrEqual(card!.y);
  });
});

for (const width of [360, 1440]) {
  test(`every Major card name is readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#pairs");
    const names = page.locator('[data-anim="pair-major"] .card-face > span:last-child');
    await expect(names).toHaveCount(3);
    for (const name of await names.all()) {
      await name.scrollIntoViewIfNeeded();
      const covered = await name.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const points = [0.1, 0.5, 0.9].map((f) => document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2));
        return points.some((p) => !p || !el.closest('[data-anim="pair-major"]')!.contains(p));
      });
      expect(covered, await name.textContent() ?? "").toBe(false);
    }
  });
}
