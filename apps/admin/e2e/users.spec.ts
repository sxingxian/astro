import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { msToNextStep, ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => sql.end());
test.beforeEach(async ({ page }) => ownIp(page));

const sessions = async (id: string) => (await sql<{ n: number }[]>`select count(*)::int as n from session where user_id = ${id}`)[0]!.n;

test("a moderator finds someone by exact email, disables them with a code, and re-enables them", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const mod = await seedPerson({ email: `mod-users-${Date.now()}@example.com`, role: "moderator", twoStep: true });
  const person = await seedPerson({ email: `seeker-${Date.now()}@example.com`, twoStep: true });
  await sql`insert into session (id, expires_at, token, user_id, surface) values (${crypto.randomUUID()}, now() + interval '1 hour', ${crypto.randomUUID()}, ${person.id}, 'app')`;
  await signInAs(context, baseURL, mod.id);

  await page.goto("/admin/users");
  await page.getByLabel("Email address").fill(person.email.slice(0, -4));
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText("No account has that exact email.")).toBeVisible();

  await page.getByLabel("Email address").fill(person.email.toUpperCase());
  await page.getByRole("button", { name: "Find" }).click();
  const card = page.getByRole("region", { name: person.email });
  await expect(card.getByText("Active")).toBeVisible();
  await expect(card.getByText("Readings", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Disable account" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await expect(dialog).toContainText(person.email);
  await dialog.getByLabel("6-digit code").fill(mod.totp!.generate());
  await dialog.getByRole("button", { name: "Disable account" }).click();
  await expect(card.getByText("Disabled", { exact: true })).toBeVisible();
  expect(await sessions(person.id)).toBe(0);
  const [u] = await sql<{ disabled_at: Date | null }[]>`select disabled_at from "user" where id = ${person.id}`;
  expect(u?.disabled_at).not.toBeNull();

  await page.waitForTimeout(msToNextStep());
  await card.getByRole("button", { name: "Enable account" }).click();
  await dialog.getByLabel("6-digit code").fill(mod.totp!.generate());
  await dialog.getByRole("button", { name: "Enable account" }).click();
  await expect(card.getByText("Active")).toBeVisible();

  await page.waitForTimeout(msToNextStep());
  await card.getByRole("button", { name: "Reset 2-step sign-in" }).click();
  await dialog.getByLabel("6-digit code").fill(mod.totp!.generate());
  await dialog.getByRole("button", { name: "Reset 2-step sign-in" }).click();
  await expect(card.getByText("2-step sign-in", { exact: true }).locator("..")).toContainText("Off");

  await page.goto("/admin/audit").catch(() => {});
  const logged = await sql<{ action: string }[]>`select action from audit_log where actor_id = ${mod.id} order by id`;
  expect(logged.map((r) => r.action)).toEqual(["user.find", "user.find", "user.disable", "user.enable", "user.reset_2fa"]);
});

test("only the owner can disable a staff account", async ({ page, context, baseURL }) => {
  const mod = await seedPerson({ email: `mod-staff-${Date.now()}@example.com`, role: "moderator", twoStep: true });
  const admin = await seedPerson({ email: `admin-target-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, mod.id);
  await page.goto("/admin/users");
  await page.getByLabel("Email address").fill(admin.email);
  await page.getByRole("button", { name: "Find" }).click();
  const card = page.getByRole("region", { name: admin.email });
  await card.getByRole("button", { name: "Disable account" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(mod.totp!.generate());
  await dialog.getByRole("button", { name: "Disable account" }).click();
  await expect(dialog.locator("[role=alert]")).toHaveText(/Only the owner/);
  const [u] = await sql<{ disabled_at: Date | null }[]>`select disabled_at from "user" where id = ${admin.id}`;
  expect(u?.disabled_at).toBeNull();
});
