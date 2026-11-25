import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-gpu", "--disable-webgl", "--disable-3d-apis"] } });

test("falls back to the static sky without WebGL", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.waitForTimeout(500);
  await expect(page.locator("canvas[data-starfield]")).toHaveCount(0);
  await expect(page.locator("[data-static-sky]")).toBeVisible();
  expect(errors).toEqual([]);
});
