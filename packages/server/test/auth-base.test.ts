import { describe, expect, it } from "vitest";
import { buildAuthOptions, type AuthSurface } from "../src/auth-base";

const env = { BETTER_AUTH_SECRET: "x".repeat(40), TURNSTILE_MODE: "on" as const, TURNSTILE_SECRET_KEY: "secret", HIBP_CHECK: "on" as const };
const deps = { db: {} as never, sendMail: async () => {}, waitUntil: () => {} };
const mail = { to: "a@example.com", subject: "s", text: "t", html: "h" };
const templates = { verifyEmail: () => mail, resetPassword: () => mail, alreadyRegistered: () => mail };
const admin: AuthSurface = { name: "admin", baseURL: "https://astro.midnightpoetry.studio/admin", basePath: "/api/auth", cookiePrefix: "astro-admin", sessionHours: 8, templates };
const app: AuthSurface = { name: "app", baseURL: "https://astroapp.midnightpoetry.studio", basePath: "/api/auth", cookiePrefix: "astro", sessionHours: 720, templates };

describe("buildAuthOptions", () => {
  it("scopes the admin surface: its own path, cookie prefix and an 8-hour session", () => {
    const o = buildAuthOptions(env, deps, admin);
    expect(o.baseURL).toBe("https://astro.midnightpoetry.studio/admin");
    expect(o.basePath).toBe("/api/auth");
    expect(o.advanced?.cookiePrefix).toBe("astro-admin");
    expect(o.session?.expiresIn).toBe(8 * 3600);
    expect(o.trustedOrigins).toEqual(["https://astro.midnightpoetry.studio"]);
  });

  it("keeps the app surface's cookie prefix", () => {
    expect(buildAuthOptions(env, deps, app).advanced?.cookiePrefix).toBe("astro");
  });

  it("carries the shared account rules on every surface", () => {
    for (const s of [admin, app]) {
      const o = buildAuthOptions(env, deps, s);
      expect(o.emailAndPassword?.minPasswordLength).toBe(12);
      expect(o.emailAndPassword?.requireEmailVerification).toBe(true);
      expect(typeof o.emailAndPassword?.password?.hash).toBe("function");
      expect(o.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip"]);
      expect(o.advanced?.useSecureCookies).toBe(true);
      expect(o.rateLimit?.storage).toBe("database");
      expect((o.plugins ?? []).map((p) => p.id).sort()).toEqual(["captcha", "have-i-been-pwned", "two-factor"]);
    }
  });
});
