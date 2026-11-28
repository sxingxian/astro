import { describe, expect, it } from "vitest";
import { authOptions as coreOptions, CAPTCHA_ENDPOINTS } from "@astro/app-core/auth-options";

// The settings Better Auth runs with (now built by astro-api through @astro/app-core); emails aren't sent here.
const noMail = async () => ({ subject: "", text: "", html: "" });
const authOptions = (e: Parameters<typeof coreOptions>[0], d: Parameters<typeof coreOptions>[1]) => coreOptions(e, d, { verifyEmail: noMail, resetPassword: noMail, alreadyRegistered: noMail } as never);

const env = {
  APP_URL: "https://astroapp.midnightpoetry.studio",
  BETTER_AUTH_SECRET: "x".repeat(40),
  EMAIL_FROM: "Astro <hello@example.com>",
  MAIL_DRIVER: "resend" as const,
  RESEND_API_KEY: "re_test",
  TURNSTILE_MODE: "on" as const,
  TURNSTILE_SECRET_KEY: "secret",
  PUBLIC_TURNSTILE_SITE_KEY: "site",
  HIBP_CHECK: "on" as const
};
const deps = { db: {} as never, sendMail: async () => {}, waitUntil: () => {} };
const ids = (o: ReturnType<typeof authOptions>) => (o.plugins ?? []).map((p) => p.id);

describe("authOptions", () => {
  it("enforces the account rules from the spec", () => {
    const o = authOptions(env, deps);
    expect(o.emailAndPassword?.minPasswordLength).toBe(12);
    expect(o.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(o.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    expect(o.trustedOrigins).toEqual([env.APP_URL]);
    expect(o.advanced?.useSecureCookies).toBe(true);
    expect(o.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip"]);
    expect(o.rateLimit?.enabled).toBe(true);
  });

  it("hashes passwords in the database, not on the Worker", () => {
    const o = authOptions(env, deps);
    expect(typeof o.emailAndPassword?.password?.hash).toBe("function");
    expect(typeof o.emailAndPassword?.password?.verify).toBe("function");
  });

  it("wires Turnstile on the sign-up, sign-in and reset endpoints, and the leaked-password check", () => {
    const o = authOptions(env, deps);
    expect(ids(o)).toEqual(expect.arrayContaining(["two-factor", "captcha", "have-i-been-pwned"]));
    expect(CAPTCHA_ENDPOINTS).toEqual(["/sign-up/email", "/sign-in/email", "/request-password-reset"]);
  });

  it("drops Turnstile and the leaked-password check only when switched off", () => {
    const o = authOptions({ ...env, APP_URL: "http://127.0.0.1:8790", TURNSTILE_MODE: "off", HIBP_CHECK: "off" }, deps);
    expect(ids(o)).toEqual(["two-factor"]);
    expect(o.advanced?.useSecureCookies).toBe(false);
  });
});
