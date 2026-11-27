import { expect } from "@playwright/test";
import { sql, test } from "./helpers";

const setMaintenance = (on: boolean) => sql`insert into app_setting (key, value) values ('maintenance_mode', ${sql.json(on)}) on conflict (key) do update set value = excluded.value`;

test.afterAll(async () => setMaintenance(false));

test("with maintenance on, the API answers 503 and every page shows the notice; health stays up", async ({ page, request, baseURL }) => {
  await setMaintenance(true);
  // The Worker caches the flag briefly (1 s under test, 60 s in production).
  await expect.poll(async () => (await request.get("/api/today")).status(), { timeout: 15_000 }).toBe(503);
  const api = await request.post("/api/draw/start", { data: { spread: "one" }, headers: { origin: baseURL ?? "" } });
  expect(api.status()).toBe(503);
  expect((await api.json()).error).toBe("maintenance");
  expect((await request.get("/api/health")).status()).toBe(200);
  // Pages are static files: they load, read the state from /api/session and show the notice instead.
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Astro is resting for a moment" })).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByRole("heading", { name: "Astro is resting for a moment" })).toBeVisible();

  await setMaintenance(false);
  await expect.poll(async () => (await request.get("/api/health")).status() === 200 && (await request.get("/api/today")).status(), { timeout: 15_000 }).toBe(200);
});
