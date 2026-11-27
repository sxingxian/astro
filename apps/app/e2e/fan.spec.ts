import { expect, type Page } from "@playwright/test";
import { newVisitor, signUpVerified, test, uniqueEmail } from "./helpers";

const stage = (page: Page) => page.getByTestId("fan-stage");
const lifted = (page: Page) => page.locator("[data-lifted]");

async function openOneCard(page: Page) {
  await page.goto("/draw/one");
  await expect(stage(page)).toBeVisible();
  await page.waitForTimeout(1500); // the fan-out settles
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`sliding across the fan lifts one card; tapping it picks it (${viewport.width} px)`, async ({ browser }) => {
    const ctx = await newVisitor(browser);
    const page = await ctx.newPage();
    await page.setViewportSize(viewport);
    await openOneCard(page);
    const box = (await stage(page).boundingBox())!;
    const cx = box.x + box.width / 2;
    const y = box.y + box.height * 0.35;
    await page.mouse.move(cx - 40, y);
    await page.mouse.move(cx, y, { steps: 5 });
    await expect(lifted(page)).toHaveCount(1);
    const name = await lifted(page).getAttribute("aria-label");
    await page.mouse.click(cx, y);
    await expect(page.getByRole("button", { name: name! })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // Holding the pointer in the left edge zone turns the fan.
    const before = await stage(page).getAttribute("data-rot");
    await page.mouse.move(box.x + 20, y);
    await page.waitForTimeout(1000);
    expect(await stage(page).getAttribute("data-rot")).not.toBe(before);

    // Leaving the fan lowers the card again.
    await page.mouse.move(box.x + box.width / 2, box.y - 60);
    await expect(lifted(page)).toHaveCount(0);
    await ctx.close();
  });
}

test("a quick tap inside an edge zone picks the card under it, even while the fan turns", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await openOneCard(page);
  const box = (await stage(page).boundingBox())!;
  const y = box.y + box.height * 0.35;
  await page.mouse.move(box.x + 70, y, { steps: 4 });
  await page.waitForTimeout(300); // the fan is turning under the pointer
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await ctx.close();
});

test("the 22-card Majors fan works by keyboard, and only positions are sent", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("fan"));
  await page.goto("/draw/three");
  await expect(stage(page)).toBeVisible();
  const first = page.getByRole("button", { name: /^Card \d+ of 22$/ }).and(page.locator('[tabindex="0"]'));
  await first.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Card 4 of 22" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  const pick = page.waitForRequest((r) => r.url().includes("/api/draw/pick"));
  await page.getByRole("button", { name: "Next: choose clarifiers" }).click();
  const body = (await pick).postDataJSON() as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["positions", "sessionId", "stage"]);
  expect(body.positions).toEqual([3, 21, 20]);
});

test("with Reduce Motion the fan doesn't animate", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/draw/one");
  await expect(stage(page)).toBeVisible();
  const duration = await page.getByRole("button", { name: "Card 40 of 78" }).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
  await ctx.close();
});
