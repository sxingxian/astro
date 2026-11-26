import { expect } from "@playwright/test";
import { sql, test } from "./helpers";

const setMaintenance = (on: boolean) => sql`insert into app_setting (key, value) values ('maintenance_mode', ${sql.json(on)}) on conflict (key) do update set value = excluded.value`;

test.afterAll(async () => setMaintenance(false));

test("with maintenance on, pages and APIs answer 503 with the notice; health stays up", async ({ request }) => {
  await setMaintenance(true);
  // The app caches the flag briefly (1 s under test, 60 s in production).
  await expect.poll(async () => (await request.get("/today")).status(), { timeout: 15_000 }).toBe(503);
  const page = await request.get("/today");
  expect(page.headers()["retry-after"]).toBeTruthy();
  expect(await page.text()).toContain("Astro is resting for a moment");
  const api = await request.post("/api/draw/start", { data: { spread: "one" }, headers: { origin: new URL(page.url()).origin } });
  expect(api.status()).toBe(503);
  expect((await api.json()).error).toBe("maintenance");
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/maintenance")).status()).toBe(200);

  await setMaintenance(false);
  await expect.poll(async () => (await request.get("/today")).status(), { timeout: 15_000 }).toBe(200);
});
