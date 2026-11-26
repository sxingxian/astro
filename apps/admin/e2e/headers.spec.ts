import { expect, test } from "@playwright/test";

test("portal pages carry the security headers and stay out of search engines", async ({ request }) => {
  const res = await request.get("/admin/sign-in");
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/nonce-[A-Za-z0-9+/=]+/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-robots-tag"]).toBe("noindex, nofollow");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("health check answers under /admin", async ({ request }) => {
  const res = await request.get("/admin/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("the page's scripts and styles load from under /admin", async ({ request }) => {
  const html = await (await request.get("/admin/sign-in")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/admin\/_next\/static\/[^"]+)"/g)].map((m) => m[1] as string);
  expect(assets.length).toBeGreaterThan(0);
  for (const a of assets.slice(0, 5)) expect((await request.get(a)).status(), a).toBe(200);
});
