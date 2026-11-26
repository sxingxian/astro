import { describe, expect, it } from "vitest";
import { acceptSession, buildAuthOptions, type AuthSurface } from "../src/auth-base";

const env = { BETTER_AUTH_SECRET: "x".repeat(40), TURNSTILE_MODE: "on" as const, TURNSTILE_SECRET_KEY: "secret", HIBP_CHECK: "on" as const };
const deps = { db: {} as never, sendMail: async () => {}, waitUntil: () => {} };
const mail = { to: "a@example.com", subject: "s", text: "t", html: "h" };
const templates = { verifyEmail: () => mail, resetPassword: () => mail, alreadyRegistered: () => mail };
const admin: AuthSurface = { name: "admin", baseURL: "https://astro.midnightpoetry.studio", basePath: "/admin/api/auth", homeURL: "https://astro.midnightpoetry.studio/admin", cookiePrefix: "astro-admin", sessionHours: 8, templates };
const app: AuthSurface = { name: "app", baseURL: "https://astroapp.midnightpoetry.studio", basePath: "/api/auth", homeURL: "https://astroapp.midnightpoetry.studio", cookiePrefix: "astro", sessionHours: 720, templates };

describe("buildAuthOptions", () => {
  it("scopes the admin surface: its own path, cookie prefix and an 8-hour session", () => {
    const o = buildAuthOptions(env, deps, admin);
    // Better Auth routes on basePath alone, so the portal's /admin prefix belongs there, not in baseURL.
    expect(o.baseURL).toBe("https://astro.midnightpoetry.studio");
    expect(o.basePath).toBe("/admin/api/auth");
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

describe("session surfaces", () => {
  it("records which surface made each session, and that people can be disabled", () => {
    const o = buildAuthOptions(env, deps, admin);
    expect(o.session?.additionalFields?.surface).toMatchObject({ type: "string", input: false, defaultValue: "admin" });
    expect(o.user?.additionalFields?.disabledAt).toMatchObject({ type: "date", input: false });
    expect(typeof o.databaseHooks?.session?.create?.before).toBe("function");
  });

  it("accepts a session only on the surface that made it, and never for a disabled person", () => {
    expect(acceptSession({ surface: "app" }, { disabledAt: null }, "app")).toBe(true);
    expect(acceptSession({ surface: "admin" }, { disabledAt: null }, "app")).toBe(false);
    expect(acceptSession({ surface: "app" }, { disabledAt: null }, "admin")).toBe(false);
    expect(acceptSession({}, { disabledAt: null }, "admin")).toBe(false);
    expect(acceptSession({ surface: "app" }, { disabledAt: new Date() }, "app")).toBe(false);
  });
});
