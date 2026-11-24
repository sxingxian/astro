import { expect, test } from "@playwright/test";

test("starfield canvas renders in the hero without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await expect(page.locator("#top canvas[data-starfield]")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("does not mount the WebGL canvas", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await expect(page.locator("canvas[data-starfield]")).toHaveCount(0);
    await expect(page.locator("[data-static-sky]")).toBeVisible();
  });
});
