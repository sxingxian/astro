import { expect } from "@playwright/test";
import { sql, test } from "./helpers";

test.afterAll(async () => {
  await sql`delete from text_version where kind = 'landing'`;
  await sql`delete from text_preview`;
});

test("the landing build endpoint: 204 before any publish, then the newest landing version", async ({ request }) => {
  await sql`delete from text_version where kind = 'landing'`;
  expect((await request.get("/api/copy/landing")).status()).toBe(204);

  await sql`insert into text_version (kind, snapshot) values ('landing', ${sql.json({ "landing.hero.note": "Old" })})`;
  const [row] = await sql<{ id: string }[]>`insert into text_version (kind, snapshot) values ('landing', ${sql.json({ "landing.hero.note": "A new note" })}) returning id`;
  await sql`insert into text_version (kind, snapshot) values ('app', ${sql.json({})})`;
  const res = await request.get("/api/copy/landing");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("public, max-age=60");
  expect(await res.json()).toEqual({ version: Number(row!.id), overrides: { "landing.hero.note": "A new note" } });
});

test("a preview link shows draft wording with a bar, uncached and unindexed; an expired one shows live wording", async ({ page }) => {
  await sql`insert into text_preview (id, kind, snapshot, expires_at) values ('e2e-live-preview-00000', 'app', ${sql.json({ "app.sign_in.title": "Preview welcome" })}, now() + interval '30 minutes')`;
  await sql`insert into text_preview (id, kind, snapshot, expires_at) values ('e2e-old-preview-000000', 'app', ${sql.json({ "app.sign_in.title": "Stale welcome" })}, now() - interval '1 minute')`;

  const live = await page.goto("/sign-in?astro-preview=e2e-live-preview-00000");
  expect(live?.headers()["cache-control"]).toBe("no-store");
  expect(live?.headers()["x-robots-tag"]).toBe("noindex");
  await expect(page.getByRole("heading", { name: "Preview welcome" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Preview, not live");

  await page.goto("/sign-in?astro-preview=e2e-old-preview-000000");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Preview, not live")).toHaveCount(0);
});
