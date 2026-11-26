import { expect } from "@playwright/test";
import { signUpVerified, sql, test, uniqueEmail } from "./helpers";

test("a week-old reading asks how it turned out, once", async ({ page }) => {
  const email = uniqueEmail("checkin");
  await signUpVerified(page, email);
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  const at = new Date(Date.now() - 8 * 86_400_000);
  const [s] = await sql<{ id: string }[]>`
    insert into draw_session (user_id, spread, local_day, time_zone, status, created_at, completed_at)
    values (${u!.id}, 'one', ${at.toISOString().slice(0, 10)}, 'UTC', 'complete', ${at}, ${at}) returning id`;
  await sql`insert into draw_deck (session_id, stage, "order", orientations, salt, fingerprint, picks)
    values (${s!.id}, 'single', ${["the-tower"]}::text[], ${["upright"]}::text[], '00', ${"0".repeat(32)}, ${[0]}::int[])`;

  await page.goto("/today");
  await page.getByRole("link", { name: /1 check-in waiting/ }).click();
  await expect(page.getByRole("heading", { name: "A week ago you drew The Tower" })).toBeVisible();
  await page.getByLabel("It fit").check();
  await page.getByLabel(/What happened/).fill("The team reshuffle was announced.");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText(/check-in waiting/)).toHaveCount(0);

  const [row] = await sql<{ outcome: string }[]>`select outcome from check_in where session_id = ${s!.id}`;
  expect(row?.outcome).toBe("fit");
});
