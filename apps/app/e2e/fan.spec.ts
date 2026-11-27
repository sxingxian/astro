import { expect, type Browser, type Page } from "@playwright/test";
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

test("desktop: the picker sits in the side-menu layout with D2's larger fan; the 22-card fan fits, so no edge arrows", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("fandesk"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draw/three");
  await expect(stage(page)).toHaveAttribute("data-size", "desktop");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator(".fan-edge[data-on]")).toHaveCount(0);
  await expect(page.getByRole("list", { name: /Your picks: 0 of 3/ })).toBeVisible();
});

test("phone: everything needed to pick fits on a 390 × 844 screen above the tabs", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await openOneCard(page);
  await expect(stage(page)).toHaveAttribute("data-size", "phone");
  const button = (await page.getByRole("button", { name: "Turn the card" }).boundingBox())!;
  const tabs = (await page.getByRole("navigation", { name: "App" }).boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(tabs.y);
  await ctx.close();
});

/** A phone: touch input, as on iOS and Android. */
async function phone(browser: Browser) {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "cf-connecting-ip": `10.7.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  /** A finger swipe from x0 to x1 across the fan, lasting about `ms`. */
  const swipe = async (x0: number, x1: number, y: number, ms = 160) => {
    await touch("touchStart", x0, y);
    for (let k = 1; k <= 10; k++) {
      await page.waitForTimeout(ms / 10);
      await touch("touchMove", x0 + ((x1 - x0) * k) / 10, y);
    }
    await touch("touchEnd", x1, y);
  };
  return { ctx, page, swipe };
}

/** The fan's turn, read every 25 ms for `ms`. */
async function track(page: Page, ms: number) {
  const seen: number[] = [];
  for (let t = 0; t < ms; t += 25) {
    seen.push(Number(await stage(page).getAttribute("data-rot")));
    await page.waitForTimeout(25);
  }
  return seen;
}

for (const dir of [-1, 1]) {
  test(`phone: a finger swipe ${dir < 0 ? "left" : "right"} turns the fan the same way, then it coasts to a stop with no jump back`, async ({ browser }) => {
    const { ctx, page, swipe } = await phone(browser);
    await openOneCard(page);
    const box = (await stage(page).boundingBox())!;
    const cx = box.x + box.width / 2;
    const y = box.y + box.height * 0.45;
    await swipe(cx - dir * 80, cx + dir * 80, y);
    const seen = await track(page, 1200);
    // Moved the way the finger went, and only ever further that way while coasting.
    expect(seen[0]! * dir).toBeGreaterThan(5);
    for (let k = 1; k < seen.length; k++) expect((seen[k]! - seen[k - 1]!) * dir).toBeGreaterThanOrEqual(-0.05);
    // Settled, and a swipe is not a tap: nothing picked.
    expect(seen.at(-1)).toBe(seen.at(-2));
    await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);

    // Swiping on reaches the end of the deck and stays there.
    for (let k = 0; k < 6; k++) await swipe(cx - dir * 120, cx + dir * 120, y, 120);
    const end = await track(page, 1000);
    const last = end.at(-1)!;
    for (let k = 1; k < end.length; k++) expect((end[k]! - end[k - 1]!) * dir).toBeGreaterThanOrEqual(-0.05);
    await page.waitForTimeout(300);
    expect(Number(await stage(page).getAttribute("data-rot"))).toBe(last);
    await ctx.close();
  });
}

test("phone: a tap still picks the card under the finger", async ({ browser }) => {
  const { ctx, page } = await phone(browser);
  await openOneCard(page);
  const box = (await stage(page).boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.35);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await ctx.close();
});

test("desktop mouse: dragging the fan turns it and picks nothing", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await openOneCard(page);
  const box = (await stage(page).boundingBox())!;
  const cx = box.x + box.width / 2;
  const y = box.y + box.height * 0.4;
  await page.mouse.move(cx + 100, y);
  await page.mouse.down();
  await page.mouse.move(cx - 100, y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(Number(await stage(page).getAttribute("data-rot"))).toBeLessThan(-5);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await ctx.close();
});
