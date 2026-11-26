import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { msToNextStep, ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => sql.end());
test.beforeEach(async ({ page }) => ownIp(page));

test("the owner invites a reader with a fresh code, and can cancel it", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const owner = await seedPerson({ email: `owner-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  const email = `reader-${Date.now()}@example.com`;

  await page.goto("/admin/team");
  await page.getByLabel("Their email").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("reader");
  await page.getByRole("button", { name: "Send invite" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill("000000");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.locator("[role=alert]")).toHaveText(/didn't match/);
  const code = owner.totp!.generate();
  await dialog.getByLabel("6-digit code").fill(code);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("status")).toHaveText("Invite sent: done.");
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("Invite sent");

  const [mail] = await sql<{ text: string }[]>`select text from mail_outbox where "to" = ${email} order by created_at desc limit 1`;
  expect(mail?.text).toMatch(/http:\/\/127\.0\.0\.1:8790\/invite#[A-Za-z0-9_-]{43}/);

  // The same code can't approve a second action.
  await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: "Cancel invite" }).click();
  await dialog.getByLabel("6-digit code").fill(code);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.locator("[role=alert]")).toHaveText(/used already/);
  await page.waitForTimeout(msToNextStep());
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("row", { name: new RegExp(email) })).toHaveCount(0);
});
