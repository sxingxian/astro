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
