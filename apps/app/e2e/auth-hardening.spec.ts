import { expect, type APIRequestContext } from "@playwright/test";
import { PASSWORD, signIn, signUpVerified, test, uniqueEmail } from "./helpers";

const mask = (body: Record<string, unknown>) => {
  const user = { ...(body.user as Record<string, unknown>) };
  for (const k of ["id", "email", "createdAt", "updatedAt"]) user[k] = "*";
  return { ...body, user };
};

async function signUpRaw(request: APIRequestContext, baseURL: string, email: string) {
  const res = await request.post("/api/auth/sign-up/email", {
    headers: { Origin: baseURL },
    data: { email, password: PASSWORD, name: "Friend", timeZone: "Bogus/Zone", callbackURL: "/today" }
  });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

test("sign-up answers identically for a new and an existing email", async ({ page, request, baseURL }) => {
  const existing = uniqueEmail("enum-existing");
  await signUpVerified(page, existing);
  const fresh = await signUpRaw(request, baseURL ?? "", uniqueEmail("enum-new"));
  const dupe = await signUpRaw(request, baseURL ?? "", existing);
  expect(dupe.status).toBe(fresh.status);
  expect(mask(dupe.body)).toEqual(mask(fresh.body));
});

test("Better Auth endpoints the app doesn't use are switched off", async ({ page, baseURL }) => {
  await signUpVerified(page, uniqueEmail("disabled"));
  const headers = { Origin: baseURL ?? "" };
  const calls: [string, "get" | "post", Record<string, unknown>?][] = [
    ["/api/auth/update-user", "post", { timeZone: "Not/AZone" }],
    ["/api/auth/list-sessions", "get"],
    ["/api/auth/two-factor/disable", "post", { password: PASSWORD }],
    ["/api/auth/change-password", "post", { currentPassword: PASSWORD, newPassword: "another long passphrase" }],
    ["/api/auth/change-email", "post", { newEmail: "x@example.com" }],
    ["/api/auth/delete-user", "post", {}],
    ["/api/auth/revoke-sessions", "post", {}]
  ];
  for (const [path, method, data] of calls) {
    const res = method === "get" ? await page.request.get(path, { headers }) : await page.request.post(path, { headers, data });
    expect(res.status(), path).toBe(404);
  }
});

test("changing the password signs out every other device", async ({ page, browser }) => {
  const email = uniqueEmail("change");
  await signUpVerified(page, email);
  const other = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "10.9.9.9" } });
  const p2 = await other.newPage();
  await signIn(p2, email);
  await expect(p2).toHaveURL(/\/today/);

  await page.goto("/account");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("a different long passphrase");
  await page.getByLabel("Confirm new password").fill("a different long passphrase");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Password changed. Other devices have been signed out.")).toBeVisible();
  expect(await (await p2.request.get("/api/auth/get-session")).json()).toBeNull();
  expect(await (await page.request.get("/api/auth/get-session")).json()).not.toBeNull();
  await other.close();
});
