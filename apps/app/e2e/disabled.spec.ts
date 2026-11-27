import { expect } from "@playwright/test";
import { PASSWORD, signIn, signUpVerified, sql, test, uniqueEmail } from "./helpers";

// What the portal's "Disable account" does (apps/admin/lib/users.ts disableUser): set disabled_at, end every session.
const disable = (email: string) => sql.begin(async (tx) => {
  await tx`update "user" set disabled_at = now() where email = ${email}`;
  await tx`delete from session where user_id = (select id from "user" where email = ${email})`;
});

// Ordinary pages trust the 5-minute pass (approved in the free-plan design), so a disabled person is signed out when
// it next expires. Clearing the pass here stands in for those 5 minutes passing.
test("someone disabled from the portal is signed out when their pass expires and can't sign in until re-enabled", async ({ page }) => {
  const email = uniqueEmail("disabled-by-staff");
  await signUpVerified(page, email);
  await disable(email);
  const keep = (await page.context().cookies()).filter((c) => c.name !== "astro.pass");
  await page.context().clearCookies();
  await page.context().addCookies(keep);

  // /today also works for guests, so check a page that needs an account.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, email);
  await expect(page.locator("form [role=alert]")).toHaveText("That email and password don't match.") // the same answer as a wrong password;

  await sql`update "user" set disabled_at = null where email = ${email}`;
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/today/);
});
