import { expect } from "@playwright/test";
import { signUpVerified, test, uniqueEmail } from "./helpers";

test("a member's reading lands in the journal with its note", async ({ page }) => {
  await signUpVerified(page, uniqueEmail("journal"));
  await page.goto("/draw/one");
  await page.getByRole("button", { name: "Card 40 of 78" }).click();
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
