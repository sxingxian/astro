import { majors } from "@astro/cards";
import { expect, type Page } from "@playwright/test";
import { newVisitor, signUpVerified, sql, test, uniqueEmail } from "./helpers";

const FINGERPRINT = /^[0-9a-f]{4}( [0-9a-f]{4}){7}$/;

async function drawGuestCard(page: Page) {
  await page.goto("/today");
  await page.getByRole("link", { name: "Draw today's card" }).click();
  await expect(page).toHaveURL(/\/draw\/one/);
  const fp = page.getByTestId("fingerprint").first();
  await expect(fp).toHaveText(FINGERPRINT);
  await page.getByRole("button", { name: "Card 13 of 78" }).click();
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("a guest draws today's card, once", async ({ page }) => {
  await drawGuestCard(page);
  await expect(page.getByTestId("meaning-summary").first()).not.toBeEmpty();
  await expect(page.getByText("For reflection and entertainment.")).toBeVisible();
  await expect(page.getByRole("link", { name: /create a free account/i })).toBeVisible();
  const readingUrl = page.url();

  await page.goto("/today");
  await expect(page.getByText(/You've drawn today, back at/)).toBeVisible();
  await page.goto("/draw/one");
  await expect(page).toHaveURL(readingUrl);
});

test("a reversed card is shown upside down, with \"Reversed\" underneath", async ({ page }) => {
  await sql`update app_setting set value = '1'::jsonb where key = 'reversal_rate'`;
  try {
    await drawGuestCard(page);
  } finally {
    await sql`update app_setting set value = '0.3'::jsonb where key = 'reversal_rate'`;
  }
  const card = page.getByRole("img", { name: /, reversed$/ });
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS("transform", /matrix\(-1, .*-1, 0, 0\)/);
  await expect(page.getByText("Reversed", { exact: true }).first()).toBeVisible();
});

test("a member draws three pairs in two stages", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("three"));
  await page.goto("/today");
  await page.getByRole("link", { name: "Draw three pairs" }).click();
  await expect(page).toHaveURL(/\/draw\/three/);
  await expect(page.getByTestId("fingerprint")).toHaveCount(2);

  // Before any pick, the page holds no Major card names or ids.
  const html = await page.content();
  for (const c of majors) {
    expect(html).not.toContain(`>${c.name}<`);
    expect(html).not.toContain(`"${c.id}"`);
  }

  for (const n of [2, 9, 17]) await page.getByRole("button", { name: `Card ${n} of 22` }).click();
  await page.getByRole("button", { name: "Next: choose clarifiers" }).click();
  for (const n of [5, 30, 44]) await page.getByRole("button", { name: `Card ${n} of 56` }).click();
  await page.getByRole("button", { name: "Turn all six cards" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  for (const pos of ["Past", "Present", "Future"]) await expect(page.getByRole("heading", { name: pos, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Verify this shuffle" }).click();
  await expect(page.getByText("Matches ✓")).toHaveCount(2);
  const salt = page.getByLabel("Salt").first();
  await salt.fill("00".repeat(16));
  await expect(page.getByText("Doesn't match").first()).toBeVisible();
});

test("the guest flow works by keyboard alone", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.goto("/today");
  const link = page.getByRole("link", { name: "Draw today's card" });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/draw\/one/);
  await expect(page.getByTestId("fingerprint")).toHaveText(FINGERPRINT);
  await page.getByRole("button", { name: "Card 1 of 78" }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Card 5 of 78" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Card 5 of 78" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Turn the card" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/reading\//);
  await ctx.close();
});

test("draw screens fit a 360 px phone and calm motion is respected", async ({ browser }) => {
  const ctx = await newVisitor(browser);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/today", "/draw/one"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }
  await page.getByRole("button", { name: "Card 3 of 78" }).click();
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.waitForTimeout(400);
  const moving = await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const t = (a as CSSTransition).transitionProperty;
      const frames = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
      return a.playState === "running" && (t === "transform" || frames.some((f) => "transform" in f));
    }).length
  );
  expect(moving).toBe(0);
  await ctx.close();
});
