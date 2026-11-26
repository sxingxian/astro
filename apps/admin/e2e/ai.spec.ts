import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { msToNextStep, ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => sql.end());
test.beforeEach(async ({ page }) => ownIp(page));

const KEY = "sk-ant-test-THISISTHESECRET-9f3Q";

test("the owner adds a service; the key is encrypted, never shown again, and the owner is emailed", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-ai-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/admin/api/ai/")) bodies.push(await r.text().catch(() => ""));
  });

  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "AI settings" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Readiness" })).toContainText("Not ready");

  await page.getByRole("button", { name: "Add a service" }).click();
  const form = page.getByRole("form", { name: "Add a service" });
  await form.getByLabel("Type").selectOption("anthropic");
  await form.getByLabel("Name").fill("Anthropic Claude");
  await form.getByLabel("Company").fill("Anthropic");
  await form.getByLabel("Model").fill("claude-test");
  await form.getByLabel("Key").fill(KEY);
  await form.getByRole("button", { name: "Save service" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Save the key" }).click();

  const row = page.getByRole("row", { name: /Anthropic Claude/ });
  await expect(row).toContainText("••••9f3Q");
  await row.getByRole("button", { name: "Test" }).click();
  await expect(row).toContainText("Test passed");

  await page.reload();
  const html = await page.content();
  expect(html).toContain("9f3Q");
  expect(html).not.toContain("THISISTHESECRET");
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(b).not.toContain("THISISTHESECRET");

  const [stored] = await sql<{ key_ciphertext: Buffer; key_last4: string }[]>`select key_ciphertext, key_last4 from ai_service where name = 'Anthropic Claude'`;
  expect(stored?.key_last4).toBe("9f3Q");
  expect(stored?.key_ciphertext.toString("utf8")).not.toContain("THISISTHESECRET");
  const [mail] = await sql<{ subject: string; text: string }[]>`select subject, text from mail_outbox where "to" = ${owner.email} order by created_at desc limit 1`;
  expect(mail?.subject).toBe("Astro: an AI service key was changed");
  expect(mail?.text).not.toContain("THISISTHESECRET");
  const [entry] = await sql<{ summary: Record<string, string> }[]>`select summary from audit_log where actor_id = ${owner.id} and action = 'ai.key_change'`;
  expect(entry?.summary).toMatchObject({ provider: "anthropic", last4: "9f3Q" });
});

test("a failing test shows the provider's error without the key", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-aibad-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/ai");
  await page.getByRole("button", { name: "Add a service" }).click();
  const form = page.getByRole("form", { name: "Add a service" });
  await form.getByLabel("Type").selectOption("openai");
  await form.getByLabel("Name").fill("Broken");
  await form.getByLabel("Company").fill("OpenAI");
  await form.getByLabel("Model").fill("bad-model");
  await form.getByLabel("Key").fill(KEY);
  await form.getByRole("button", { name: "Save service" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Save the key" }).click();
  const row = page.getByRole("row", { name: /Broken/ });
  await row.getByRole("button", { name: "Test" }).click();
  await expect(row).toContainText("Key rejected");
  await expect(row).toContainText("[redacted]");
  await expect(row).not.toContainText("THISISTHESECRET");
});

test("roles need a main service and 2 fallbacks each", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const owner = await seedPerson({ email: `owner-airoles-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await sql`delete from ai_service`;
  for (const [name, company] of [["Claude", "Anthropic"], ["GPT", "OpenAI"], ["Gemini", "Google"], ["Mistral", "Mistral AI"]] as const) {
    await sql`insert into ai_service (provider, name, company, model, key_last4, last_test_ok) values ('anthropic', ${name}, ${company}, 'm', 'abcd', true)`;
  }
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/ai");
  const writer = page.getByRole("group", { name: "Writer" });
  await writer.getByLabel("Main").selectOption({ label: "Claude · Anthropic" });
  await writer.getByLabel("Fallback 1").selectOption({ label: "GPT · OpenAI" });
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await page.getByRole("button", { name: "Save roles" }).click();
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByRole("region", { name: "Roles" }).locator("[role=alert]")).toContainText("Writer needs a main service and at least 2 fallbacks");
  expect((await sql`select 1 from ai_role_slot`).length).toBe(0);

  const pick = async (role: string, names: string[]) => {
    const g = page.getByRole("group", { name: role });
    for (const [i, n] of names.entries()) await g.getByLabel(i === 0 ? "Main" : `Fallback ${i}`).selectOption({ label: n });
  };
  await pick("Writer", ["Claude · Anthropic", "GPT · OpenAI", "Gemini · Google"]);
  await pick("Checker 1", ["GPT · OpenAI", "Gemini · Google", "Mistral · Mistral AI"]);
  await pick("Checker 2", ["Gemini · Google", "Mistral · Mistral AI", "Claude · Anthropic"]);
  await page.waitForTimeout(msToNextStep());
  await page.getByRole("button", { name: "Save roles" }).click();
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByRole("status", { name: "Readiness" })).toContainText("Ready");
  expect((await sql`select 1 from ai_role_slot`).length).toBe(9);
});

test("an admin can't open AI settings or call its routes", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-ai-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  const origin = new URL(baseURL ?? "").origin;
  for (const path of ["/admin/api/ai/service", "/admin/api/ai/key", "/admin/api/ai/roles", "/admin/api/ai/test"]) {
    expect((await page.request.post(path, { data: {}, headers: { origin } })).status(), path).toBe(403);
  }
});

test("every AI change needs a fresh code, not only keys", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-aistep-${Date.now()}@example.com`, role: "owner", twoStep: true });
  const [svc] = await sql<{ id: string }[]>`insert into ai_service (provider, name, company, model, base_url, key_last4, last_test_ok) values ('openai_compatible', 'Other', 'Other Co', 'm', 'https://api.example.ai/v1', 'abcd', true) returning id`;
  await signInAs(context, baseURL, owner.id);
  const origin = new URL(baseURL ?? "").origin;
  const post = (path: string, data: unknown) => page.request.post(path, { data, headers: { origin } });

  const moved = await post("/admin/api/ai/service", { id: svc!.id, provider: "openai_compatible", name: "Other", company: "Other Co", model: "m", baseUrl: "https://attacker.example/v1", enabled: true });
  expect(moved.status()).toBe(403);
  expect((await moved.json()).error).toMatch(/^step_up_/);
  expect((await sql<{ base_url: string }[]>`select base_url from ai_service where id = ${svc!.id}`)[0]?.base_url).toBe("https://api.example.ai/v1");

  expect((await post("/admin/api/ai/roles", { slots: [] })).status()).toBe(403);
  const cap = await post("/admin/api/settings", { values: { ai_daily_cap_usd: 999 } });
  expect(cap.status()).toBe(403);
  expect((await sql<{ value: number }[]>`select value from app_setting where key = 'ai_daily_cap_usd'`)[0]?.value).toBe(20);
});
