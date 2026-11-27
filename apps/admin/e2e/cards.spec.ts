import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => {
  await sql`delete from text_override where kind = 'meanings'`;
  await sql.end();
});
test.beforeEach(async ({ page }) => ownIp(page));

test("the owner changes The Star's upright summary and publishes it with a code", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-cards-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/cards");
  await page.getByLabel("Find a card").fill("star");
  await page.getByRole("link", { name: /The Star/ }).click();
  await expect(page.getByRole("heading", { name: "The Star · upright" })).toBeVisible();

  const upright = page.getByRole("region", { name: "The Star · upright" });
  await upright.getByLabel("Your summary").fill("Hope and renewal after a hard stretch");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").first()).toContainText("Draft saved");

  await page.getByRole("button", { name: "Publish 1 change" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").first()).toContainText("Published");

  const [v] = await sql<{ snapshot: Record<string, string> }[]>`select snapshot from text_version where kind = 'meanings' order by id desc limit 1`;
  expect(v?.snapshot).toEqual({ "the-star.upright.summary": "Hope and renewal after a hard stretch" });
});

test("an admin sees the card library read-only", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-cards-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/cards?card=the-star");
  await expect(page.getByRole("heading", { name: "The Star · upright" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Your/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save draft|Publish|Restore/ })).toHaveCount(0);
});
