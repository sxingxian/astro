import { randomUUID } from "node:crypto";
import { serializeSignedCookie } from "better-call";
import { createDb } from "@astro/db";
import { createHttpDb } from "@astro/db/http";
import { neonFetchOverPostgres, resetAndMigrate } from "@astro/db/testing";
import { signPass } from "@astro/server/pass";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dueCheckIns } from "../../app/lib/check-ins";
import { findToday, pick, startDraw } from "../../app/lib/draw/service";
import { listReadings } from "../../app/lib/journal";
import { readerStatus } from "../../app/lib/readers";
import { createApp } from "../src/index";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");

const env = { DATABASE_URL: webUrl, BETTER_AUTH_SECRET: "test-better-auth-secret-0123456789abcdef", PASS_SECRET: "test-pass-secret-0123456789abcdefghij", APP_URL: "http://127.0.0.1:8791" };
const admin = postgres(url, { max: 1, onnotice: () => {} });
const tcp = createDb(webUrl);
const fake = neonFetchOverPostgres(webUrl);
const http = createHttpDb(webUrl, { fetch: fake.fetch });
let clock = Date.now();
let dbMade = 0;
const app = createApp({
  db: () => {
    dbMade++;
    return http;
  },
  now: () => clock
});

async function signed(token: string) {
  const header = await serializeSignedCookie("x", token, env.BETTER_AUTH_SECRET);
  return header.slice(2, header.indexOf(";") > 0 ? header.indexOf(";") : undefined);
}

async function person(opts: { disabled?: boolean } = {}) {
  const uid = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  await admin`insert into "user" (id, email, name, email_verified, time_zone) values (${uid}, ${`${uid}@example.com`}, '', true, 'Asia/Singapore')`;
  await admin`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${new Date(Date.now() + 86_400_000)}, 'app')`;
  if (opts.disabled) await admin`update "user" set disabled_at = now() where id = ${uid}`;
  // APP_URL is http here, so Better Auth's cookie has no __Secure- prefix.
  return { uid, token, cookie: `astro.session_token=${await signed(token)}` };
}

const get = (path: string, cookie?: string, method = "GET") => app.request(path, { method, headers: cookie ? { cookie } : {} }, env);
const passFrom = (res: Response) => /astro\.pass=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await admin.end({ timeout: 1 });
  await tcp.$client.end({ timeout: 1 });
  await fake.end();
});

describe("data Worker", () => {
  it("answers health without the database, or even a database client", async () => {
    const before = fake.calls();
    const made = dbMade;
    const res = await get("/api/v2/health");
    expect(await res.json()).toEqual({ ok: true });
    expect(fake.calls()).toBe(before);
    expect(dbMade).toBe(made);
  });

  it("signed out: 401, no pass, security headers and no-store", async () => {
    const res = await get("/api/v2/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ user: null });
    expect(passFrom(res)).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("signed in: issues the pass, then answers from it without a database call", async () => {
    const p = await person();
    const first = await get("/api/v2/me", p.cookie);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-astro-pass")).toBe("refresh");
    const setCookie = first.headers.get("set-cookie") ?? "";
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/api", "Max-Age=300"]) expect(setCookie).toContain(attr);
    expect(await first.json()).toEqual({ user: { id: p.uid, reader: false } });

    const before = fake.calls();
    const second = await get("/api/v2/me", `${p.cookie}; astro.pass=${passFrom(first)}`);
    expect(second.headers.get("x-astro-pass")).toBe("hit");
    expect(await second.json()).toEqual({ user: { id: p.uid, reader: false } });
    expect(fake.calls()).toBe(before);
  });

  it("refuses another session's pass and checks the database instead", async () => {
    const a = await person();
    const b = await person();
    const bPass = await signPass({ uid: b.uid, sid: "x", reader: true, tz: "UTC", email: "b@example.com", ev: true, tf: false }, b.token, env.PASS_SECRET, clock);
    const res = await get("/api/v2/me", `${a.cookie}; astro.pass=${bPass}`);
    expect(res.headers.get("x-astro-pass")).toBe("refresh");
    expect(await res.json()).toEqual({ user: { id: a.uid, reader: false } });
  });

  it("a disabled person keeps a live pass for at most 5 minutes, then is signed out and the pass cleared", async () => {
    const p = await person();
    const first = await get("/api/v2/me", p.cookie);
    const pass = passFrom(first);
    await admin`update "user" set disabled_at = now() where id = ${p.uid}`;
    expect((await get("/api/v2/me", `${p.cookie}; astro.pass=${pass}`)).status).toBe(200);
    clock += 301_000;
    const later = await get("/api/v2/me", `${p.cookie}; astro.pass=${pass}`);
    expect(later.status).toBe(401);
    expect(later.headers.get("set-cookie")).toMatch(/astro\.pass=;.*Max-Age=0/);
  });

  it("serves Today's data: the same values the Today page uses now", async () => {
    const p = await person();
    const actor = { kind: "user" as const, userId: p.uid, timeZone: "Asia/Singapore" };
    // A finished reading from 8 days ago (in the journal, with a check-in due) and one in progress today.
    const old = new Date(Date.now() - 8 * 86_400_000);
    const past = await startDraw(tcp, actor, "one", old);
    await pick(tcp, actor, past.sessionId, "single", [5], old);
    await startDraw(tcp, actor, "one");
    const res = await get("/api/v2/today", p.cookie);
    expect(res.status).toBe(200);
    const expected = {
      one: await findToday(tcp, actor, "one"),
      three: await findToday(tcp, actor, "three"),
      due: await dueCheckIns(tcp, p.uid),
      recent: (await listReadings(tcp, p.uid, { limit: 3 })).items,
      reader: await readerStatus(tcp, p.uid)
    };
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(expected.one).not.toBeNull();
    expect(expected.recent.length).toBeGreaterThan(0);
    expect(expected.due.length).toBeGreaterThan(0);
  });

  it("Today needs a sign-in", async () => {
    expect((await get("/api/v2/today")).status).toBe(401);
  });

  it("refuses anything but GET in this stage", async () => {
    const p = await person();
    expect((await get("/api/v2/me", p.cookie, "POST")).status).toBe(405);
    expect((await get("/api/v2/today", p.cookie, "DELETE")).status).toBe(405);
  });

  it("unknown paths are 404", async () => {
    expect((await get("/api/v2/nope")).status).toBe(404);
  });

  it("refuses to run with missing or short secrets, without saying which", async () => {
    const res = await app.request("/api/v2/me", {}, { ...env, PASS_SECRET: "short" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
  });
});

describe("sign-in cookie name", () => {
  it("on the real https address, reads only Better Auth's __Secure- cookie", async () => {
    const p = await person();
    const https = { ...env, APP_URL: "https://astroapp.midnightpoetry.studio" };
    const token = p.cookie.split("=")[1];
    expect((await app.request("/api/v2/me", { headers: { cookie: `__Secure-astro.session_token=${token}` } }, https)).status).toBe(200);
    expect((await app.request("/api/v2/me", { headers: { cookie: `astro.session_token=${token}` } }, https)).status).toBe(401);
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
      const res = await broken.request("/api/v2/me", { headers: { cookie: p.cookie } }, env);
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
    expect(checkEnv({ ...env, APP_URL: "https://astroapp.midnightpoetry.studio", NEON_FETCH_ENDPOINT: "http://evil.example/sql" })?.NEON_FETCH_ENDPOINT).toBeUndefined();
    expect(checkEnv({ ...env, APP_URL: "http://127.0.0.1:8791", NEON_FETCH_ENDPOINT: "http://127.0.0.1:4444/sql" })?.NEON_FETCH_ENDPOINT).toBe("http://127.0.0.1:4444/sql");
  });
});
