import { describe, expect, it } from "vitest";
import { GUEST_COOKIE, guestCookie, guestIdentity } from "@/lib/draw/guest";
import { verifyTurnstile } from "@/lib/turnstile";

const req = (headers: Record<string, string>) => new Request("https://astroapp.example/api/draw/start", { headers });

describe("guestIdentity", () => {
  it("mints a new 32-hex guest id when there is no cookie", async () => {
    const g = await guestIdentity(req({ "cf-connecting-ip": "203.0.113.7" }), "s".repeat(40), new Date("2026-11-26T00:00:00Z"));
    expect(g.isNew).toBe(true);
    expect(g.id).toMatch(/^[0-9a-f]{32}$/);
    expect(g.guestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(g.guestHash).not.toContain(g.id);
  });

  it("reuses a valid cookie and ignores a malformed one", async () => {
    const id = "0123456789abcdef0123456789abcdef";
    const kept = await guestIdentity(req({ cookie: `${GUEST_COOKIE}=${id}` }), "s".repeat(40), new Date());
    expect(kept).toMatchObject({ id, isNew: false });
    const bad = await guestIdentity(req({ cookie: `${GUEST_COOKIE}=../../etc` }), "s".repeat(40), new Date());
    expect(bad.isNew).toBe(true);
  });

  it("hashes the IP with a salt that changes every UTC day", async () => {
    const r = () => req({ "cf-connecting-ip": "203.0.113.7" });
    const a = await guestIdentity(r(), "s".repeat(40), new Date("2026-11-26T01:00:00Z"));
    const b = await guestIdentity(r(), "s".repeat(40), new Date("2026-11-26T23:00:00Z"));
    const c = await guestIdentity(r(), "s".repeat(40), new Date("2026-11-27T01:00:00Z"));
    expect(a.ipHash).toBe(b.ipHash);
    expect(a.ipHash).not.toBe(c.ipHash);
    expect(a.ipHash).not.toContain("203.0.113.7");
  });

  it("sets a private, short-lived cookie", () => {
    expect(guestCookie("ab".repeat(16), true)).toBe(`${GUEST_COOKIE}=${"ab".repeat(16)}; Path=/; Max-Age=172800; HttpOnly; Secure; SameSite=Lax`);
    expect(guestCookie("ab".repeat(16), false)).not.toContain("Secure");
  });
});

describe("verifyTurnstile", () => {
  it("passes only when Cloudflare says success", async () => {
    const ok = (success: boolean) => (async () => new Response(JSON.stringify({ success }))) as unknown as typeof fetch;
    expect(await verifyTurnstile("t", "secret", "1.2.3.4", ok(true))).toBe(true);
    expect(await verifyTurnstile("t", "secret", "1.2.3.4", ok(false))).toBe(false);
    expect(await verifyTurnstile("", "secret", "1.2.3.4", ok(true))).toBe(false);
    const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile("t", "secret", "1.2.3.4", boom)).toBe(false);
  });
});
