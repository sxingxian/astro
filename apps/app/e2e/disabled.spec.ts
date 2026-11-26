import { expect } from "@playwright/test";
import { PASSWORD, signIn, signUpVerified, sql, test, uniqueEmail } from "./helpers";

// What the portal's "Disable account" does (apps/admin/lib/users.ts disableUser): set disabled_at, end every session.
const disable = (email: string) => sql.begin(async (tx) => {
  await tx`update "user" set disabled_at = now() where email = ${email}`;
  await tx`delete from session where user_id = (select id from "user" where email = ${email})`;
});

test("someone disabled from the portal is signed out at once and can't sign in until re-enabled", async ({ page }) => {
  const email = uniqueEmail("disabled-by-staff");
  await signUpVerified(page, email);
  await disable(email);

  // /today also works for guests, so check a page that needs an account.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, email);
  await expect(page.locator("form [role=alert]")).toHaveText("That email and password don't match.") // the same answer as a wrong password;

  await sql`update "user" set disabled_at = null where email = ${email}`;
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/today/);
});
