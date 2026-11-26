import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const dev = {
  ADMIN_URL: "http://127.0.0.1:8791/admin",
  APP_URL: "http://127.0.0.1:8790",
  BETTER_AUTH_SECRET: "dev-only-secret-change-me-0123456789abcdef",
  EMAIL_FROM: "Astro <hello@example.com>",
  MAIL_DRIVER: "outbox",
  TURNSTILE_MODE: "off",
  HIBP_CHECK: "off",
  PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  AI_KEY_ENCRYPTION_KEY: "0".repeat(64),
  AI_GATEWAY_URL: "http://127.0.0.1:8799/gateway",
  OWNER_ALERTS: "on"
};
const prod = {
  ...dev,
  ADMIN_URL: "https://astro.midnightpoetry.studio/admin",
  APP_URL: "https://astroapp.midnightpoetry.studio",
  MAIL_DRIVER: "resend",
  RESEND_API_KEY: "re_x",
  TURNSTILE_MODE: "on",
  TURNSTILE_SECRET_KEY: "s",
  HIBP_CHECK: "on",
  AI_GATEWAY_URL: "https://gateway.ai.cloudflare.com/v1/acct/astro"
};

describe("admin parseEnv", () => {
  it("accepts development values", () => {
    expect(parseEnv(dev).ADMIN_URL).toBe(dev.ADMIN_URL);
  });

  it("accepts production values", () => {
    expect(parseEnv(prod).MAIL_DRIVER).toBe("resend");
  });

  it("refuses development shortcuts on the production address", () => {
    expect(() => parseEnv({ ...prod, MAIL_DRIVER: "outbox" })).toThrow(/outbox/);
    expect(() => parseEnv({ ...prod, TURNSTILE_MODE: "off" })).toThrow(/TURNSTILE/);
    expect(() => parseEnv({ ...prod, HIBP_CHECK: "off" })).toThrow(/HIBP/);
    expect(() => parseEnv({ ...prod, RESEND_API_KEY: undefined })).toThrow(/RESEND_API_KEY/);
    expect(() => parseEnv({ ...prod, AI_GATEWAY_URL: "http://127.0.0.1:8799/gateway" })).toThrow(/AI_GATEWAY_URL/);
  });

  it("requires a 64-character hex AI key encryption key", () => {
    expect(() => parseEnv({ ...dev, AI_KEY_ENCRYPTION_KEY: "0".repeat(63) })).toThrow();
    expect(() => parseEnv({ ...dev, AI_KEY_ENCRYPTION_KEY: "g".repeat(64) })).toThrow();
  });
});
