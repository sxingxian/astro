import { expect, test, type Page } from "@playwright/test";

async function deckSamples(page: Page, count: number, gapMs: number) {
  const samples: string[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-anim="deck-card"], [data-anim="deck-chosen"], [data-anim="deck-flipper"]'))
          .map((el) => getComputedStyle(el).transform)
          .join("|")
      )
    );
    await page.waitForTimeout(gapMs);
  }
  return samples;
}

test.describe("default motion", () => {
  test("smooth scroll is on and the deck ritual plays in view", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/lenis/);
    await page.locator("#deck").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const samples = await deckSamples(page, 4, 700);
    expect(new Set(samples).size).toBeGreaterThan(1);
  });

  test("the hero card stays card-sized while it enters and follows the pointer", async ({ page }) => {
    await page.goto("/");
    const card = page.locator('[data-anim="hero-card"]');
    let maxWidth = 0;
    for (let i = 0; i < 14; i++) {
      await page.mouse.move(600 + i * 3, 80 + i);
      maxWidth = Math.max(maxWidth, (await card.boundingBox())?.width ?? 0);
      await page.waitForTimeout(90);
    }
    // The card is 120px wide; tilt and bob may add a little, never a screen-wide ray.
    expect(maxWidth).toBeLessThan(170);
  });

  test("headline descenders are not clipped by the reveal masks", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const clipped = await page.locator("#h-sky .line").evaluateAll((els) => els.filter((el) => el.scrollHeight > el.clientHeight).length);
    expect(clipped).toBe(0);
  });

  test("keyboard anchor navigation focuses the target chapter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Begin the journey" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#deck")).toBeFocused();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("every section is visible straight away, without scrolling or fading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", /.+/);
    const opacities = await page.locator('[data-anim="reveal"]').evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(0);
    expect(opacities.every((o) => o === "1")).toBe(true);
  });

  test("no smooth scroll, no deck loop, all content revealed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
    await page.locator("#deck").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    const samples = await deckSamples(page, 3, 500);
    expect(new Set(samples).size).toBe(1);

    for (const id of ["pairs", "thread", "promise", "deeper"]) {
      await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    const opacities = await page.locator('[data-anim="reveal"]').evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    expect(opacities.every((o) => o === "1")).toBe(true);
  });
});
