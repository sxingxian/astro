import * as OTPAuth from "otpauth";
import { expect, type Page } from "@playwright/test";
import { ownerId, PASSWORD, signUpVerified, sql, test, uniqueEmail } from "./helpers";

const guidelines = (heading: string) => ({ "legal.guidelines": JSON.stringify({ v: 1, blocks: [{ t: "h2", c: [{ t: "text", text: heading }] }] }) });

async function turnOnTwoStep(page: Page) {
  await page.goto("/account#two-step");
  await page.getByRole("button", { name: "Turn on 2-step sign-in" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const totp = OTPAuth.URI.parse((await page.getByTestId("totp-uri").getAttribute("data-uri")) ?? "") as OTPAuth.TOTP;
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "I've saved them" }).click();
}

test.afterAll(async () => {
  await sql`delete from text_version where kind = 'guidelines'`;
});

test("an offered account accepts the reader role with the current guidelines, gets Desk, and can give it up", async ({ page }) => {
  test.setTimeout(90_000);
  await sql`delete from text_version where kind = 'guidelines'`;
  await sql`insert into text_version (kind, snapshot) values ('guidelines', ${sql.json(guidelines("Guidelines, first edition"))})`;
  const email = uniqueEmail("offered");
  await signUpVerified(page, email);
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  await sql`insert into role_offer (user_id, reader, offered_by, expires_at) values (${u!.id}, true, ${await ownerId()}, now() + interval '72 hours')`;

  // Without an authenticator the offer can't be accepted yet.
  await page.goto("/offer");
  await expect(page.getByRole("heading", { name: "You've been asked to read for Astro" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up authenticator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toBeDisabled();

  await turnOnTwoStep(page);
  await page.goto("/offer");
  const box = page.getByRole("region", { name: "Reader guidelines" });
  await expect(box.getByRole("heading", { name: "Guidelines, first edition" })).toBeVisible();
  await page.getByLabel("I've read the reader guidelines and agree to them").check();

  // The guidelines are republished while the page is open: accepting asks the person to read them again.
  await sql`insert into text_version (kind, snapshot) values ('guidelines', ${sql.json(guidelines("Guidelines, second edition"))})`;
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("The guidelines just changed. Please read them again.")).toBeVisible();
  await expect(box.getByRole("heading", { name: "Guidelines, second edition" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toBeDisabled();
  await page.getByLabel("I've read the reader guidelines and agree to them").check();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();

  await page.getByRole("link", { name: "Open Desk" }).click();
  await expect(page.getByRole("heading", { name: "Your Desk" })).toBeVisible();
  await expect(page.getByText("Private to you. Astro staff can't see it in the app or portal.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "My log" })).toBeVisible();
  const [logged] = await sql<{ summary: { reader: boolean } }[]>`select summary from audit_log where actor_id = ${u!.id} and action = 'reader.accept'`;
  expect(logged?.summary.reader).toBe(true);

  // Giving the role up removes Desk straight away.
  await page.goto("/account");
  await page.getByRole("button", { name: "Give up reader role" }).click();
  await page.getByRole("button", { name: "Give it up" }).click();
  await expect(page.getByRole("button", { name: "Give up reader role" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "My log" })).toHaveCount(0);
  await page.goto("/desk");
  await expect(page).toHaveURL(/\/today$/);
});

test("Desk asks a reader to agree again after the guidelines are republished", async ({ page }) => {
  const email = uniqueEmail("reagree");
  await signUpVerified(page, email);
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  await sql`insert into reader_role (user_id) values (${u!.id})`;
  await sql`insert into guideline_acceptance (user_id, version) values (${u!.id}, 0)`;
  await sql`insert into text_version (kind, snapshot) values ('guidelines', ${sql.json(guidelines("Guidelines, updated"))})`;
  await page.goto("/desk");
  await expect(page.getByRole("heading", { name: "The reader guidelines have changed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my log" })).toHaveCount(0);
  await page.getByLabel("I've read the reader guidelines and agree to them").check();
  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page.getByRole("link", { name: "Open my log" })).toBeVisible();
});
