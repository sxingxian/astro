import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/** Every app route's first-load JavaScript must stay under 200 KB gzipped (spec: performance budget). */
export const BUDGET_KB = 200;
const ROUTES = ["/today", "/sign-up", "/sign-in", "/draw/one"];

for (const route of ROUTES) {
  test(`first-load JS on ${route} is under ${BUDGET_KB} KB gzipped`, async ({ page }) => {
    const sizes = new Map<string, number>();
    page.on("response", async (res) => {
      if (res.request().resourceType() !== "script") return;
      const body = await res.body().catch(() => null);
      if (body) sizes.set(res.url(), gzipSync(body).length);
    });
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const totalKb = [...sizes.values()].reduce((a, b) => a + b, 0) / 1024;
    console.log(`${route}: ${totalKb.toFixed(1)} KB gzipped across ${sizes.size} scripts`);
    expect(totalKb).toBeLessThan(BUDGET_KB);
  });
}
