import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ownIp, signInAs } from "./helpers";
import { seedPerson } from "./seed";

const sql = postgres(process.env.DATABASE_URL_TEST ?? "", { max: 1, onnotice: () => {} });

/** Stands in for the landing page's Deploy Hook (LANDING_DEPLOY_HOOK_URL in .dev.vars). */
const hookCalls: string[] = [];
let hook: Server;
test.beforeAll(async () => {
  hook = createServer((req, res) => {
    hookCalls.push(`${req.method} ${req.url}`);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: true }));
  });
  await new Promise<void>((resolve) => hook.listen(8798, "127.0.0.1", () => resolve()));
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => hook.close(() => resolve()));
  await sql`delete from text_override`;
  await sql.end();
});
test.beforeEach(async ({ page }) => ownIp(page));

test("the owner edits the landing heading and publishes; the landing page rebuilds once, and not again within 2 minutes", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-text-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/text");
  await expect(page.getByRole("heading", { name: "Text", exact: true })).toBeVisible();

  await page.getByRole("group", { name: "I · The sky" }).getByRole("button", { name: /^Heading/ }).click();
  await expect(page.getByText("Every day,\none card turns.").first()).toBeVisible();
  await page.getByLabel("Your text").fill("Each morning,\none card turns for you.");
  await expect(page.getByRole("region", { name: "How it will read" })).toContainText("one card turns for you.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").first()).toContainText("Draft saved");

  const publish = page.getByRole("region", { name: "Publish the landing page" });
  await expect(publish).toContainText("I · The sky · Heading");
  await publish.getByLabel("Note for the history (optional)").fill("Warmer morning wording");
  await publish.getByRole("button", { name: "Publish 1 change" }).click();
  await expect(publish.getByRole("status")).toContainText("Published version");
  await expect(publish.getByRole("status")).toContainText("about 5 minutes");
  expect(hookCalls).toEqual(["POST /deploy-hook"]);
  await expect(page.getByRole("region", { name: "Live now" })).toContainText(/Version \d+/);

  const [v] = await sql<{ snapshot: Record<string, string>; note: string }[]>`select snapshot, note from text_version where kind = 'landing' order by id desc limit 1`;
  expect(v).toEqual({ snapshot: { "landing.hero.title": "Each morning,\none card turns for you." }, note: "Warmer morning wording" });

  await page.getByRole("group", { name: "I · The sky" }).getByRole("button", { name: /^Note/ }).click();
  await page.getByLabel("Your text").fill("Free, always");
  await page.getByRole("button", { name: "Save draft" }).click();
  await publish.getByRole("button", { name: "Publish 1 change" }).click();
  await expect(publish.getByRole("alert")).toHaveText("You can publish again in 2 minutes.");
  expect(hookCalls).toHaveLength(1);
});

test("an over-length draft shows the problem and can't be saved", async ({ page, context, baseURL }) => {
  const admin = await seedPerson({ email: `admin-text-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, admin.id);
  await page.goto("/admin/text");
  await page.getByRole("group", { name: "I · The sky" }).getByRole("button", { name: /^Main button/ }).click();
  await page.getByLabel("Your text").fill("x".repeat(200));
  await expect(page.getByText(/200 of \d+ characters/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
});

test("app wording publishes live, and restoring an older version publishes it again as the newest", async ({ page, context, baseURL }) => {
  const owner = await seedPerson({ email: `owner-text-app-${Date.now()}@example.com`, role: "owner", twoStep: true });
  await signInAs(context, baseURL, owner.id);
  await page.goto("/admin/text?tab=app");
  const publish = page.getByRole("region", { name: "Publish the app and emails" });

  await page.getByLabel("Search the wording").fill("Today's card");
  await page.getByRole("group", { name: "Today" }).getByRole("button").first().click();
  await page.getByLabel("Your text").fill("Tonight's card");
  await page.getByRole("button", { name: "Save draft" }).click();
  await publish.getByRole("button", { name: /^Publish 1 change/ }).click();
  await expect(publish.getByRole("status")).toContainText("live within a minute");
  const [first] = await sql<{ id: string }[]>`select id from text_version where kind = 'app' order by id desc limit 1`;

  await page.getByRole("button", { name: "Use default" }).click();
  await publish.getByRole("button", { name: /^Publish 1 change/ }).click();
  await expect(publish.getByRole("status")).toContainText(`Published version ${Number(first!.id) + 1}`);

  const history = page.getByRole("region", { name: "History" });
  await history.getByRole("button", { name: `Restore version ${first!.id}` }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("6-digit code").fill(owner.totp!.generate());
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("region", { name: "Live now" })).toContainText(`Version ${Number(first!.id) + 2}`);

  const [latest] = await sql<{ id: string; snapshot: Record<string, string> }[]>`select id, snapshot from text_version where kind = 'app' order by id desc limit 1`;
  expect(Number(latest!.id)).toBe(Number(first!.id) + 2);
  await expect(page.getByRole("region", { name: "Live now" })).toContainText(`Version ${latest!.id}`);
  expect(Object.values(latest!.snapshot)).toContain("Tonight's card");
});
