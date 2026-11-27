import { expect, type Page } from "@playwright/test";
import { pickCard, signUpVerified, test, uniqueEmail } from "./helpers";

const mainWidth = (page: Page) => page.locator("[data-page]").first().evaluate((el) => el.getBoundingClientRect().width);
const noSideScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test("on desktop, screens use two columns where the mockups do; on phones they stay one column", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("desk"));
  await page.goto("/draw/one");
  await pickCard(page, 20, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  const reading = page.url();

  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/today", "/journal", "/journal/patterns", "/account", reading]) {
      await page.goto(path);
      expect(await mainWidth(page), `${path} at ${width}`).toBeGreaterThan(560);
      await noSideScroll(page, width);
    }
    await page.goto(reading);
    const card = (await page.getByRole("img").first().boundingBox())!;
    const meaning = (await page.getByTestId("meaning-summary").first().boundingBox())!;
    expect(card.x + card.width).toBeLessThanOrEqual(meaning.x);
    for (const path of ["/draw/three", "/ask", "/privacy", "/check-in/x"]) {
      await page.goto(path);
      await noSideScroll(page, width);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/today", "/journal", "/journal/patterns", "/account", reading]) {
    await page.goto(path);
    expect(await mainWidth(page), path).toBeLessThanOrEqual(390);
    await noSideScroll(page, 390);
  }
});

test("every screen has the side menu on desktop and the bottom tabs on phones", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("shell"));
  // The draw page first: once today's card is drawn it sends you to the reading instead.
  for (const [width, menu] of [[1280, true], [390, false]] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/draw/one");
    await expect(page.getByRole("navigation", { name: "Main menu" }), `/draw/one at ${width}`).toBeVisible({ visible: menu });
    await expect(page.getByRole("navigation", { name: "App" }), `/draw/one at ${width}`).toBeVisible({ visible: !menu });
  }
  await page.setViewportSize({ width: 1280, height: 844 });
  await pickCard(page, 7, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  const reading = new URL(page.url()).pathname;
  const paths = ["/today", "/draw/three", reading, `${reading}/verify`, "/journal", "/journal/patterns", "/account", "/ask", "/privacy", "/reader-guidelines"];
  for (const [width, menu, tabs] of [[1280, true, false], [390, false, true]] as const) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Main menu" }), `${path} at ${width}`).toBeVisible({ visible: menu });
      await expect(page.getByRole("navigation", { name: "App" }), `${path} at ${width}`).toBeVisible({ visible: tabs });
    }
  }
  // Today on desktop follows mockup D1: greeting, Ask panel, the two spreads and the right-hand column.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/today");
  await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)\.$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask a question" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent readings" })).toBeVisible();
  // The drawn card is random, so find the reading by its link, not its name.
  await expect(page.getByRole("region", { name: "Recent readings" }).locator('a[href^="/reading/"]').first()).toBeVisible();
});
