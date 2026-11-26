import { expect, test } from "@playwright/test";

test("serves the app with a nonce CSP and security headers", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  const headers = res?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scriptNonces = await page.$$eval("script", (els) => els.map((s) => s.nonce || s.getAttribute("nonce") || ""));
  expect(scriptNonces.length).toBeGreaterThan(0);
  for (const n of scriptNonces) expect(n).toBe(nonce);

  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("refuses state changes from another origin", async ({ request }) => {
  const res = await request.post("/api/health", { headers: { Origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("accepts state changes from its own origin", async ({ request, baseURL }) => {
  const res = await request.post("/api/health", { headers: { Origin: baseURL ?? "" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
