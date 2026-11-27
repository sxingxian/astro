import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { signUpVerified, sql, test, uniqueEmail } from "./helpers";

async function becomeReader(page: Page) {
  const email = uniqueEmail("logger");
  await signUpVerified(page, email);
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  const [v] = await sql<{ v: string }[]>`select coalesce(max(id), 0) as v from text_version where kind = 'guidelines'`;
  await sql`insert into reader_role (user_id) values (${u!.id})`;
  await sql`insert into guideline_acceptance (user_id, version) values (${u!.id}, ${Number(v!.v)})`;
}

async function pick(page: Page, slot: RegExp, query: string, card: string, reversed = false) {
  await page.getByRole("button", { name: slot }).click();
  const d = page.getByRole("dialog", { name: "Which card did you draw?" });
  await d.getByLabel("Search cards").fill(query);
  await d.getByRole("button", { name: card, exact: true }).click();
  if (reversed) await d.getByRole("radio", { name: "Reversed" }).click();
  await d.getByRole("button", { name: "Use this card" }).click();
  await expect(d).toBeHidden();
}

test("a reader records a three-pair reading, edits it, downloads the log and deletes the entry", async ({ page }) => {
  test.setTimeout(90_000);
  await becomeReader(page);
  await page.goto("/desk/log");
  await expect(page.getByText("Private to you. Astro staff can't see it in the app or portal.").first()).toBeVisible();
  await page.getByRole("link", { name: "Record a reading" }).click();

  await page.getByLabel("Who you read for").fill("Hannah");
  await page.getByLabel("Their question (optional)").fill("Should I go back to school?");
  await page.getByRole("radio", { name: "Three cards" }).click();
  await page.getByRole("radio", { name: /Major, then Minor/ }).click();
  await pick(page, /^Past · Major:/, "fool", "The Fool");
  await pick(page, /^Past · Minor clarifier:/, "two cups", "Two of Cups");
  await pick(page, /^Present · Major:/, "hermit", "The Hermit", true);
  await pick(page, /^Present · Minor clarifier:/, "ace wands", "Ace of Wands");
  await pick(page, /^Future · Major:/, "star", "The Star");
  await pick(page, /^Future · Minor clarifier:/, "king swords", "King of Swords");
  await page.getByRole("button", { name: "Add an accompanying card" }).click();
  await pick(page, /^Accompanying cards \(optional\):/, "eight cups", "Eight of Cups");
  await page.getByLabel("Goes with").selectOption({ label: "Present" });
  await page.getByLabel("Your notes").fill("Torn between security and growth.");
  await page.getByRole("button", { name: "Save to my log" }).click();
  await expect(page.getByText("Check the reading")).toBeVisible(); // consent is needed
  await page.getByLabel("They're happy for me to keep a note of this reading.").check();
  await page.getByRole("button", { name: "Save to my log" }).click();

  await expect(page).toHaveURL(/\/desk\/log$/);
  const entry = page.getByRole("link", { name: /Hannah/ });
  await expect(entry).toContainText("The Hermit (reversed)");
  await expect(entry).toContainText("The Fool + Two of Cups"); // pairs shown as in mockup D4

  await entry.click();
  await expect(page.getByRole("heading", { name: "Edit reading" })).toBeVisible();
  await expect(page.getByLabel("Goes with")).toHaveValue("1");
  await page.getByLabel("Your notes").fill("She already knows.");
  await page.getByRole("button", { name: "Save to my log" }).click();
  await expect(page).toHaveURL(/\/desk\/log$/);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download CSV" }).click()]);
  const csv = readFileSync((await download.path())!, "utf8");
  expect(csv).toContain('"Hannah"');
  expect(csv).toContain("She already knows.");

  await page.getByRole("link", { name: /Hannah/ }).click();
  await page.getByRole("button", { name: "Delete this reading" }).click();
  await page.getByRole("button", { name: "Delete it" }).click();
  await expect(page).toHaveURL(/\/desk\/log$/);
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
});

test("someone without the reader role gets 404 for the log and its API", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("notreader"));
  const res = await page.goto("/desk/log");
  expect(res?.status()).toBe(404);
  const api = await page.request.get("/api/reader/log/export");
  expect(api.status()).toBe(403);
});
