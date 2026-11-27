import { expect } from "@playwright/test";
import { sql, test } from "./helpers";

const page1 = (blocks: unknown[]) => ({ "legal.terms": JSON.stringify({ v: 1, blocks }) });

test.afterAll(async () => {
  await sql`delete from text_version where kind in ('terms', 'privacy')`;
});

test("Terms and Privacy are app pages; published wording shows as plain text", async ({ page }) => {
  await sql`delete from text_version where kind in ('terms', 'privacy')`;
  // Each page's published version is cached for a minute per isolate, so the default is checked on /privacy
  // and the published version on /terms, which hasn't been read yet in this run.
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await expect(page.getByText(/Last updated/)).toHaveCount(0);

  await sql`insert into text_version (kind, snapshot) values ('terms', ${sql.json(page1([{ t: "h2", c: [{ t: "text", text: "Our terms" }] }, { t: "p", c: [{ t: "text", text: "<script>window.x=1</script>" }] }, { t: "p", c: [{ t: "text", text: "Contact", href: "https://example.com/help" }] }]))})`;
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Our terms" })).toBeVisible();
  await expect(page.getByText("<script>window.x=1</script>")).toBeVisible();
  await expect(page.locator("main script")).toHaveCount(0);
  await expect(page.getByText(/Last updated/)).toBeVisible();
  const link = page.getByRole("link", { name: "Contact" });
  await expect(link).toHaveAttribute("href", "https://example.com/help");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("the sign-up page links to the app's own Terms and Privacy", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/privacy");
});
