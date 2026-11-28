import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/env";

const local = {
  APP_URL: "http://127.0.0.1:8790",
  BETTER_AUTH_SECRET: "x".repeat(40),
  EMAIL_FROM: "Astro <hello@example.com>",
  MAIL_DRIVER: "outbox",
  TURNSTILE_MODE: "off",
  PUBLIC_TURNSTILE_SITE_KEY: "site",
  HIBP_CHECK: "off"
};

describe("parseEnv (rules the schema enforces)", () => {
  it("returns only the app's settings, with the maintenance cache defaulting to 60 s", () => {
    const env = parseEnv({ ...local, DATABASE_URL: "postgres://x", OTHER: 1 });
    expect(env).toEqual({ ...local, MAINTENANCE_CACHE_SECONDS: 60 });
  });

  it("reads the maintenance cache as a whole number of seconds from 0 to 300", () => {
    expect(parseEnv({ ...local, MAINTENANCE_CACHE_SECONDS: "1" }).MAINTENANCE_CACHE_SECONDS).toBe(1);
    expect(parseEnv({ ...local, MAINTENANCE_CACHE_SECONDS: 0 }).MAINTENANCE_CACHE_SECONDS).toBe(0);
    for (const bad of ["301", "-1", "1.5", "abc"]) expect(() => parseEnv({ ...local, MAINTENANCE_CACHE_SECONDS: bad }), bad).toThrow();
  });

  it("refuses a missing or malformed address, unknown options and missing required values", () => {
    expect(() => parseEnv({ ...local, APP_URL: "not a url" })).toThrow();
    expect(() => parseEnv({ ...local, APP_URL: undefined })).toThrow();
    expect(() => parseEnv({ ...local, ADMIN_URL: "nope" })).toThrow();
    expect(parseEnv({ ...local, ADMIN_URL: "http://127.0.0.1:8791/admin" }).ADMIN_URL).toBe("http://127.0.0.1:8791/admin");
    expect(() => parseEnv({ ...local, MAIL_DRIVER: "smtp" })).toThrow();
    expect(() => parseEnv({ ...local, TURNSTILE_MODE: "maybe" })).toThrow();
    expect(() => parseEnv({ ...local, HIBP_CHECK: true })).toThrow();
    expect(() => parseEnv({ ...local, EMAIL_FROM: "ab" })).toThrow();
    expect(() => parseEnv({ ...local, PUBLIC_TURNSTILE_SITE_KEY: undefined })).toThrow();
    expect(() => parseEnv({ ...local, BETTER_AUTH_SECRET: "x".repeat(31) })).toThrow();
  });

  it("requires the Turnstile secret whenever Turnstile is on", () => {
    expect(() => parseEnv({ ...local, TURNSTILE_MODE: "on" })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(parseEnv({ ...local, TURNSTILE_MODE: "on", TURNSTILE_SECRET_KEY: "s" }).TURNSTILE_SECRET_KEY).toBe("s");
  });
});
