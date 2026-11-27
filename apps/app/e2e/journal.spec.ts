import { expect } from "@playwright/test";
import { pickCard, signUpVerified, test, uniqueEmail } from "./helpers";

test("a member's reading lands in the journal with its note", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("journal"));
  await page.goto("/draw/one");
  await pickCard(page, 40, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  const name = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";

  await page.getByLabel("Your note").fill("Felt calmer after the walk.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved.")).toBeVisible();

  await page.goto("/journal");
  const row = page.getByRole("link", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Note: Felt calmer after the walk.");
});

test("Patterns waits for a few readings before drawing conclusions", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("patterns"));
  await page.goto("/draw/one");
  await pickCard(page, 7, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await expect(page).toHaveURL(/\/reading\//);
  await page.goto("/journal");
  await page.getByRole("link", { name: "Patterns" }).click();
  await expect(page).toHaveURL(/\/journal\/patterns/);
  await expect(page.getByRole("heading", { name: "Patterns appear after a few readings" }).first()).toBeVisible();
  await expect(page.getByText("1 reading", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/range=all/);
});
