import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { buildCsp } from "@/lib/csp";

const base = {
  APP_URL: "https://astroapp.midnightpoetry.studio",
  BETTER_AUTH_SECRET: "x".repeat(40),
  EMAIL_FROM: "Astro <hello@example.com>",
  MAIL_DRIVER: "resend",
  RESEND_API_KEY: "re_test",
  TURNSTILE_MODE: "on",
  TURNSTILE_SECRET_KEY: "secret",
  PUBLIC_TURNSTILE_SITE_KEY: "site",
  HIBP_CHECK: "on"
};

describe("parseEnv", () => {
  it("accepts a complete production config", () => {
    expect(parseEnv(base).APP_URL).toBe(base.APP_URL);
  });

  it.each([
    ["MAIL_DRIVER", "outbox"],
    ["TURNSTILE_MODE", "off"],
    ["HIBP_CHECK", "off"]
  ])("refuses %s=%s on the production address", (key, value) => {
    expect(() => parseEnv({ ...base, [key]: value })).toThrow(/not allowed in production/);
  });

  it("requires the Resend and Turnstile secrets in production", () => {
    expect(() => parseEnv({ ...base, RESEND_API_KEY: undefined })).toThrow(/RESEND_API_KEY/);
    expect(() => parseEnv({ ...base, TURNSTILE_SECRET_KEY: undefined })).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("allows development shortcuts on a local address", () => {
    expect(parseEnv({ ...base, APP_URL: "http://127.0.0.1:8790", MAIL_DRIVER: "outbox", TURNSTILE_MODE: "off", HIBP_CHECK: "off", RESEND_API_KEY: undefined }).MAIL_DRIVER).toBe("outbox");
  });

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow();
  });
});

describe("buildCsp", () => {
  it("is strict in production", () => {
    const csp = buildCsp("abc");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
});
