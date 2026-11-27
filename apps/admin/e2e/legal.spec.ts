import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });
test.afterAll(async () => {
  await sql`delete from text_override where kind in ('terms', 'privacy', 'guidelines')`;
  await sql.end();
});
test.beforeEach(async ({ page }) => ownIp(page));

test("the owner writes Terms in the Notion-style editor and publishes only that page", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-legal-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/text?tab=legal");
  await expect(page.getByRole("heading", { name: "Terms of use · Legal" })).toBeVisible();

  const editor = page.getByRole("textbox", { name: "Terms of use" });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/head");
  await page.getByRole("option", { name: /^Heading/ }).click();
  await page.keyboard.type("Your data");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- first point");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").first()).toContainText("Draft saved");

  const publish = page.getByRole("region", { name: "Publish Terms of use" });
  const [appBefore] = await sql<{ n: number }[]>`select count(*)::int as n from text_version where kind = 'app'`;
  await publish.getByRole("button", { name: "Publish 1 change" }).click();
  await expect(publish.getByRole("status")).toContainText("Published version");

  const [v] = await sql<{ snapshot: Record<string, string> }[]>`select snapshot from text_version where kind = 'terms' order by id desc limit 1`;
  const doc = JSON.parse(v!.snapshot["legal.terms"]!) as { blocks: { t: string; c?: { text: string }[]; items?: { text: string }[][] }[] };
  expect(doc.blocks).toContainEqual({ t: "h2", c: [{ t: "text", text: "Your data" }] });
  expect(doc.blocks).toContainEqual({ t: "ul", items: [[{ t: "text", text: "first point" }]] });
  const [appAfter] = await sql<{ n: number }[]>`select count(*)::int as n from text_version where kind = 'app'`;
  expect(appAfter!.n).toBe(appBefore!.n);
});
