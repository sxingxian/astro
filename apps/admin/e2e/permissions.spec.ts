import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { seedPerson } from "./seed";

// Every portal mutation, with the actions a role must NOT be allowed. Later tasks add their routes here.
const ROUTES: { path: string; body: Record<string, unknown>; deny: ("admin" | "moderator")[] }[] = [
  { path: "/admin/api/team/invite", body: { email: "x@example.com", role: "moderator", code: "000000" }, deny: ["moderator"] },
  { path: "/admin/api/team/revoke", body: { inviteId: crypto.randomUUID(), code: "000000" }, deny: ["moderator"] },
  { path: "/admin/api/team/role", body: { userId: "nobody", role: "moderator", code: "000000" }, deny: ["moderator"] },
  { path: "/admin/api/team/remove", body: { userId: "nobody", code: "000000" }, deny: ["moderator"] }
];

for (const role of ["admin", "moderator"] as const) {
  test(`a ${role} is refused every route their role doesn't allow, before any code is checked`, async ({ context, baseURL }) => {
    const s = await seedPerson({ email: `${role}-perm-${Date.now()}@example.com`, role, twoStep: true });
    await signInAs(context, baseURL, s.id);
    const origin = new URL(baseURL ?? "http://127.0.0.1:8791").origin;
    for (const r of ROUTES.filter((x) => x.deny.includes(role))) {
      const res = await context.request.post(r.path, { data: r.body, headers: { origin } });
      expect(res.status(), r.path).toBe(403);
      expect((await res.json()).error, r.path).toBe("forbidden");
    }
  });
}

test("an admin can't invite another admin", async ({ context, baseURL }) => {
  const s = await seedPerson({ email: `admin-noadmin-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, s.id);
  const res = await context.request.post("/admin/api/team/invite", { data: { email: "y@example.com", role: "admin", code: s.totp!.generate() }, headers: { origin: new URL(baseURL ?? "").origin } });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toBe("forbidden_role");
});

test("a reader, or someone with an app session, gets nothing from portal routes", async ({ context, baseURL }) => {
  const reader = await seedPerson({ email: `reader-perm-${Date.now()}@example.com`, role: "reader", twoStep: true });
  await signInAs(context, baseURL, reader.id);
  const origin = new URL(baseURL ?? "").origin;
  for (const r of ROUTES) expect((await context.request.post(r.path, { data: r.body, headers: { origin } })).status(), r.path).toBe(401);
  await context.clearCookies();
  const staff = await seedPerson({ email: `app-sess-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, staff.id, "app");
  for (const r of ROUTES) expect((await context.request.post(r.path, { data: r.body, headers: { origin } })).status(), r.path).toBe(401);
});

test("portal routes refuse other origins", async ({ context, baseURL }) => {
  const s = await seedPerson({ email: `origin-${Date.now()}@example.com`, role: "admin", twoStep: true });
  await signInAs(context, baseURL, s.id);
  const res = await context.request.post("/admin/api/team/invite", { data: { email: "z@example.com", role: "reader", code: "000000" }, headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});
