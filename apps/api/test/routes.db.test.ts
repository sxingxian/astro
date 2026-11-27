import { createHmac, randomUUID } from "node:crypto";
import { createDb, createHttpDb } from "@astro/db";
import { neonFetchOverPostgres, resetAndMigrate } from "@astro/db/testing";
import { signPass } from "@astro/server";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dueCheckIns } from "../../app/lib/check-ins";
import { findToday, startDraw } from "../../app/lib/draw/service";
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
const app = createApp({ db: () => http, now: () => clock });

const signed = (token: string) => encodeURIComponent(`${token}.${createHmac("sha256", env.BETTER_AUTH_SECRET).update(token).digest("base64")}`);

async function person(opts: { disabled?: boolean } = {}) {
  const uid = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  await admin`insert into "user" (id, email, name, email_verified, time_zone) values (${uid}, ${`${uid}@example.com`}, '', true, 'Asia/Singapore')`;
  await admin`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${new Date(Date.now() + 86_400_000)}, 'app')`;
  if (opts.disabled) await admin`update "user" set disabled_at = now() where id = ${uid}`;
  return { uid, token, cookie: `__Secure-astro.session_token=${signed(token)}` };
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
  it("answers health without the database", async () => {
    const before = fake.calls();
    const res = await get("/api/v2/health");
    expect(await res.json()).toEqual({ ok: true });
    expect(fake.calls()).toBe(before);
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
    const bPass = await signPass({ uid: b.uid, sid: "x", reader: true, tz: "UTC" }, b.token, env.PASS_SECRET, clock);
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
