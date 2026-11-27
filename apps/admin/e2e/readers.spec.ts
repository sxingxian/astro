import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => sql.end());
test.beforeEach(async ({ page }) => ownIp(page));

test("the owner adds the reader role to their own account from Team", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-reader-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/team");
  const row = page.getByRole("row", { name: new RegExp(owner.email) });
  await row.getByRole("button", { name: "Add reader role" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("status")).toHaveText("Reader role added: done.");
  await expect(row).toContainText("Owner");
  await expect(row).toContainText("+ Reader");
  await expect(row.getByRole("button", { name: "Remove reader role" })).toBeVisible();
});

test("an admin offers the reader role from Users; Team lists the pending offer with Withdraw", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-offer-${Date.now()}@example.com`, role: "admin", twoStep: true });
  const member = await seedPerson({ email: `member-offer-${Date.now()}@example.com` });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/users");
  await page.getByLabel("Email address").fill(member.email);
  await page.getByRole("button", { name: "Find" }).click();
  await page.getByRole("button", { name: "Offer a role" }).click();
  const form = page.getByRole("form", { name: "Offer a role" });
  await expect(form.getByRole("checkbox")).toBeChecked();
  await form.getByRole("button", { name: "Send offer" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(admin.totp!.generate());
  await dialog.getByRole("button", { name: "Send offer" }).click();
  await expect(page.getByRole("status")).toContainText("Offer sent");

  const [mail] = await sql<{ text: string }[]>`select text from mail_outbox where "to" = ${member.email} order by created_at desc limit 1`;
  expect(mail?.text).toContain("http://127.0.0.1:8790/offer");

  await page.goto("/admin/team");
  const row = page.getByRole("row", { name: new RegExp(member.email) });
  await expect(row).toContainText("Offer sent");
  await expect(row).toContainText("Reader");
  await expect(row.getByRole("button", { name: "Withdraw offer" })).toBeVisible();
});
