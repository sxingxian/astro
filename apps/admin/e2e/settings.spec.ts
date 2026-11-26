import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
const restore = () => sql`update app_setting set value = case key when 'guest_daily_cap' then '3'::jsonb when 'maintenance_mode' then 'false'::jsonb else value end where key in ('guest_daily_cap', 'maintenance_mode')`;
test.afterAll(async () => {
  await restore();
  await sql.end();
});
test.beforeEach(async ({ page }) => ownIp(page));

test("an admin changes the guest daily cap; the change is saved and audited", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-settings-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();
  // AI spending limits belong to the owner's AI settings, not here.
  await expect(page.getByLabel(/AI/)).toHaveCount(0);

  await page.getByLabel("Guest draws per day").fill("25");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Guest draws per day");
  await page.getByLabel("Guest draws per day").fill("5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const [row] = await sql<{ value: number }[]>`select value from app_setting where key = 'guest_daily_cap'`;
  expect(row?.value).toBe(5);
  const [entry] = await sql<{ summary: { setting: string; value: string } }[]>`select summary from audit_log where actor_id = ${admin.id} and action = 'settings.change'`;
  expect(entry?.summary).toEqual({ setting: "guest_daily_cap", value: "5" });
  await restore();
});

test("turning maintenance mode on asks for a code; turning it off doesn't", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-maint-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/settings");
  await page.getByRole("switch", { name: "Maintenance mode" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(admin.totp!.generate());
  await dialog.getByRole("button", { name: "Pause the app" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  expect((await sql<{ value: boolean }[]>`select value from app_setting where key = 'maintenance_mode'`)[0]?.value).toBe(true);

  await page.getByRole("switch", { name: "Maintenance mode" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(dialog).toBeHidden();
  expect((await sql<{ value: boolean }[]>`select value from app_setting where key = 'maintenance_mode'`)[0]?.value).toBe(false);
});

test("a moderator can't open Site settings or change one", async ({ page, context, baseURL }) => {
  const mod = await seedPerson({ email: `mod-settings-${Date.now()}@example.com`, role: "moderator", twoStep: true });
  await signInAs(context, baseURL, mod.id);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  const res = await page.request.post("/admin/api/settings", { data: { values: { guest_daily_cap: 9 } }, headers: { origin: new URL(baseURL ?? "").origin } });
  expect(res.status()).toBe(403);
});
