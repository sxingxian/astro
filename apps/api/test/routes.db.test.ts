import { resetAndMigrate } from "@astro/db/testing";
import { signPass } from "@astro/server/pass";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, fake, http, passFrom, person, tcp } from "./helpers";

let clock = Date.now();
let dbMade = 0;
const app = createApp({
  db: () => {
    dbMade++;
    return http;
  },
  txDb: () => ({ db: tcp, end: async () => {} }),
  now: () => clock
});

const get = (path: string, cookie?: string, method = "GET") => app.request(path, { method, headers: cookie ? { cookie } : {} }, env);

beforeAll(async () => {
  await resetAndMigrate(dbUrl);
});
afterAll(closeAll);

describe("data Worker", () => {
  it("answers health without the database, or even a database client", async () => {
    const before = fake.calls();
    const made = dbMade;
    const res = await get("/api/health");
    expect(await res.json()).toEqual({ ok: true });
    expect(fake.calls()).toBe(before);
    expect(dbMade).toBe(made);
  });

  it("signed out: 401, no pass, security headers and no-store", async () => {
    const res = await get("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
    expect(passFrom(res)).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("signed in: issues the pass, then answers from it without a database call", async () => {
    const p = await person();
    const first = await get("/api/me", p.cookie);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-astro-pass")).toBe("refresh");
    const setCookie = first.headers.get("set-cookie") ?? "";
    for (const attr of ["HttpOnly", "SameSite=Lax", "Path=/api", "Max-Age=300"]) expect(setCookie).toContain(attr);
    // Secure on https only (local http runs couldn't keep it otherwise); see the https test below.
    expect(setCookie).not.toContain("Secure");
    expect(await first.json()).toEqual({ user: { id: p.uid, reader: false } });

    const before = fake.calls();
    const second = await get("/api/me", `${p.cookie}; astro.pass=${passFrom(first)}`);
    expect(second.headers.get("x-astro-pass")).toBe("hit");
    expect(await second.json()).toEqual({ user: { id: p.uid, reader: false } });
    expect(fake.calls()).toBe(before);
  });

  it("refuses another session's pass and checks the database instead", async () => {
    const a = await person();
    const b = await person();
    const bPass = await signPass({ uid: b.uid, sid: "x", reader: true, tz: "UTC", email: "b@example.com", ev: true, tf: false }, b.token, env.PASS_SECRET, clock);
    const res = await get("/api/me", `${a.cookie}; astro.pass=${bPass}`);
    expect(res.headers.get("x-astro-pass")).toBe("refresh");
    expect(await res.json()).toEqual({ user: { id: a.uid, reader: false } });
  });

  it("a disabled person keeps a live pass for at most 5 minutes, then is signed out and the pass cleared", async () => {
    const p = await person();
    const first = await get("/api/me", p.cookie);
    const pass = passFrom(first);
    await admin`update "user" set disabled_at = now() where id = ${p.uid}`;
    expect((await get("/api/me", `${p.cookie}; astro.pass=${pass}`)).status).toBe(200);
    clock += 301_000;
    const later = await get("/api/me", `${p.cookie}; astro.pass=${pass}`);
    expect(later.status).toBe(401);
    expect(later.headers.get("set-cookie")).toMatch(/astro\.pass=;.*Max-Age=0/);
  });

  it("unknown paths are 404", async () => {
    expect((await get("/api/nope")).status).toBe(404);
  });

  it("refuses to run with missing or short secrets, without saying which", async () => {
    const res = await app.request("/api/me", {}, { ...env, PASS_SECRET: "short" });
    expect(res.status).toBe(500);
    // The app's own rules apply too: no outbox mail on the production address.
    const prod = await app.request("/api/me", {}, { ...env, APP_URL: "https://astroapp.midnightpoetry.studio" });
    expect(prod.status).toBe(500);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
  });
});

describe("sign-in cookie name", () => {
  it("on the real https address, reads only Better Auth's __Secure- cookie", async () => {
    const p = await person();
    const https = { ...env, APP_URL: "https://staging.example.com" };
    const token = p.cookie.split("=")[1];
    expect((await app.request("/api/me", { headers: { cookie: `__Secure-astro.session_token=${token}` } }, https)).status).toBe(200);
    const ok = await app.request("/api/me", { headers: { cookie: `__Secure-astro.session_token=${token}` } }, https);
    expect(ok.headers.get("set-cookie")).toContain("Secure");
    expect((await app.request("/api/me", { headers: { cookie: `astro.session_token=${token}` } }, https)).status).toBe(401);
  });
});

describe("errors", () => {
  it("logs a failed request without the query's values (a session token must not reach the logs)", async () => {
    const p = await person();
    const broken = createApp({
      db: () => {
        throw Object.assign(new Error(`Failed query: select ... params: ${p.token}`), { name: "DrizzleQueryError" });
      }
    });
    const logged: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
    try {
      const res = await broken.request("/api/me", { headers: { cookie: p.cookie } }, env);
      expect(res.status).toBe(500);
    } finally {
      console.error = orig;
    }
    expect(logged.join("\n")).not.toContain(p.token);
    expect(logged.join("\n")).toContain("DrizzleQueryError");
  });
});

describe("settings", () => {
  it("ignores a local query endpoint unless the Worker itself runs locally", async () => {
    const { checkEnv } = await import("../src/env");
    expect(checkEnv({ ...env, APP_URL: "https://staging.example.com", NEON_FETCH_ENDPOINT: "http://evil.example/sql" })?.NEON_FETCH_ENDPOINT).toBeUndefined();
    expect(checkEnv({ ...env, APP_URL: "http://127.0.0.1:8791", NEON_FETCH_ENDPOINT: "http://127.0.0.1:4444/sql" })?.NEON_FETCH_ENDPOINT).toBe("http://127.0.0.1:4444/sql");
  });
});
