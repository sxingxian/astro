import { expect, test } from "@playwright/test";

const DISCLAIMER = "For reflection and entertainment. Not a substitute for medical, legal or financial advice.";

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders the six-chapter journey", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every day, one card turns.");
    for (const id of ["top", "deck", "pairs", "thread", "promise", "deeper"]) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
    const cta = page.getByRole("link", { name: "Draw today's card" }).first();
    await expect(cta).toHaveAttribute("href", "https://astroapp.midnightpoetry.studio/today");
    for (const title of ["Your daily card is free, forever", "No ads, no trackers", "Shuffles you can verify", "Your readings stay yours"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    await expect(page.getByText("Priced in the app").first()).toBeVisible();
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("has no horizontal scroll at 360px", async ({ page }) => {
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("all content is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const opacities = await page.locator('[data-anim="reveal"]').evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(10);
    expect(opacities.every((o) => o === "1")).toBe(true);
  });
});
