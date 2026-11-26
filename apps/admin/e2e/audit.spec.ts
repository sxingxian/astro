import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { PASSWORD, seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => sql.end());
test.beforeEach(async ({ page }) => ownIp(page));

test("sign-ins, invites and role changes are logged and shown on the Audit screen", async ({ page, context, baseURL }) => {
  const stamp = Date.now();
  const owner = await seedPerson({ email: `owner-audit-${stamp}@example.com`, role: "owner", twoStep: true });
  const admin = await seedPerson({ email: `admin-audit-${stamp}@example.com`, role: "admin", twoStep: true });
  const mod = await seedPerson({ email: `mod-audit-${stamp}@example.com`, role: "moderator", twoStep: true });
  const origin = new URL(baseURL ?? "http://127.0.0.1:8791").origin;

  // The admin changes the moderator's role (through the API, with their own fresh code).
  const adminCtx = await context.browser()!.newContext({ baseURL });
  await signInAs(adminCtx, baseURL, admin.id);
  const changed = await adminCtx.request.post("/admin/api/team/role", { data: { userId: mod.id, role: "reader", code: admin.totp!.generate() }, headers: { origin } });
  expect(changed.status()).toBe(200);
  await adminCtx.close();

  // The owner sends an invite (through the API, with a fresh code)...
  const invited = `invited-audit-${stamp}@example.com`;
  const ownerCtx = await context.browser()!.newContext({ baseURL });
  await signInAs(ownerCtx, baseURL, owner.id);
  const sent = await ownerCtx.request.post("/admin/api/team/invite", { data: { email: invited, role: "reader", code: owner.totp!.generate() }, headers: { origin } });
  expect(sent.status()).toBe(200);
  await ownerCtx.close();

  // ...then signs in through the real form with their authenticator.
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("6-digit code").fill(owner.totp!.generate());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  // One sign-in, logged when the code was accepted, not also at the password step.
  const signIns = await sql<{ summary: { method: string } }[]>`select summary from audit_log where actor_id = ${owner.id} and action = 'auth.sign_in'`;
  expect(signIns.map((r) => r.summary.method)).toEqual(["authenticator"]);
  // The sign-in code is burned: it can't approve an action as well.
  const reused = await page.request.post("/admin/api/team/invite", { data: { email: `reuse-${stamp}@example.com`, role: "reader", code: owner.totp!.generate() }, headers: { origin } });
  expect((await reused.json()).error).toBe("step_up_replayed");

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  const rows = page.getByRole("region", { name: "Audit entries" }).getByRole("row");
  await expect(rows.filter({ hasText: "Invited someone" }).filter({ hasText: invited })).toContainText("You · Owner");
  await expect(rows.filter({ hasText: "Changed a role" }).filter({ hasText: mod.email })).toContainText(`${admin.email} · Admin`);
  await expect(rows.filter({ hasText: "Signed in" }).filter({ hasText: "You · Owner" }).first()).toBeVisible();

  // Filters narrow the list.
  await page.getByLabel("Action").selectOption("sign_in");
  await expect(page).toHaveURL(/group=sign_in/);
  await expect(rows.filter({ hasText: "Invited someone" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Signed in" }).first()).toBeVisible();

  // The CSV download has the entries, and downloading is itself logged.
  const csv = await page.request.get("/admin/api/audit/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(invited);
  await page.goto("/admin/audit");
  await expect(rows.filter({ hasText: "Downloaded the audit log" }).first()).toBeVisible();
});

test("a moderator can't see the audit log or download it", async ({ page, context, baseURL }) => {
  const mod = await seedPerson({ email: `mod-noaudit-${Date.now()}@example.com`, role: "moderator", twoStep: true });
  await signInAs(context, baseURL, mod.id);
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Audit entries" })).toHaveCount(0);
  expect((await page.request.get("/admin/api/audit/export")).status()).toBe(403);
});
