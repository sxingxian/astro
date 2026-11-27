import { neonWsOverPostgres, resetAndMigrate } from "@astro/db/testing";
import { createWsDb } from "@astro/db/ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, execution, freshIp, http, passFrom, person, webUrl } from "./helpers";

let proxy: Awaited<ReturnType<typeof neonWsOverPostgres>>;
const app = createApp({ db: () => http, txDb: () => createWsDb(webUrl, { wsProxy: proxy.address }) });
const run = execution();
const send = async (path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}) => {
  const res = await app.request(path, { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body) }, env, run.ctx);
  await run.settle();
  return res;
};
const PASSWORD = "correct horse battery staple";

/** A person signed up and verified through Better Auth itself (for routes that check the password). */
async function member() {
  const email = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await send("/api/auth/sign-up/email", { email, password: PASSWORD, name: "Friend", timeZone: "Asia/Singapore", callbackURL: "/today" });
  const [mail] = await admin<{ text: string }[]>`select text from mail_outbox where "to" = ${email} order by created_at desc limit 1`;
  const link = new URL(/(https?:\/\/\S+)/.exec(mail!.text)![1]!);
  await app.request(link.pathname + link.search, {}, env);
  const res = await send("/api/auth/sign-in/email", { email, password: PASSWORD });
  const token = /astro\.session_token=([^;]+)/.exec(res.headers.getSetCookie().join("\n"))![1];
  const [u] = await admin<{ id: string }[]>`select id from "user" where email = ${email}`;
  return { email, uid: u!.id, cookie: `astro.session_token=${token}` };
}

async function completedReading(cookie: string) {
  const s = (await (await send("/api/draw/start", { spread: "one" }, cookie)).json()) as { sessionId: string };
  await send("/api/draw/pick", { sessionId: s.sessionId, stage: "single", positions: [2] }, cookie);
  return s.sessionId;
}

beforeAll(async () => {
  await resetAndMigrate(dbUrl);
  proxy = await neonWsOverPostgres();
});
afterAll(async () => {
  await proxy.close();
  await closeAll();
});

describe("journal and check-ins", () => {
  it("saves a note and the private flag on your own reading only", async () => {
    const p = await person();
    const id = await completedReading(p.cookie);
    expect((await send(`/api/reading/${id}/note`, { body: "The tower again." }, p.cookie)).status).toBe(200);
    expect((await send(`/api/reading/${id}/private`, { value: true }, p.cookie)).status).toBe(200);
    const [row] = await admin<{ private: boolean }[]>`select private from draw_session where id = ${id}`;
    expect(row!.private).toBe(true);
    const other = await person();
    expect((await send(`/api/reading/${id}/note`, { body: "mine now" }, other.cookie)).status).toBe(404);
    expect((await send(`/api/reading/${id}/note`, { body: "x".repeat(2300) }, p.cookie)).status).toBe(400);
  });

  it("a check-in can't be saved before it is due", async () => {
    const p = await person();
    const id = await completedReading(p.cookie);
    const res = await send(`/api/check-in/${id}`, { outcome: "fit" }, p.cookie);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "too_soon" });
  });

  it("needs a sign-in and the app's own origin", async () => {
    expect((await send("/api/reading/00000000-0000-0000-0000-000000000000/note", { body: "x" })).status).toBe(401);
    const p = await person();
    expect((await send("/api/account/check-ins", { enabled: false }, p.cookie, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("account", () => {
  it("turns check-ins off", async () => {
    const p = await person();
    expect((await send("/api/account/check-ins", { enabled: false }, p.cookie)).status).toBe(200);
    const [u] = await admin<{ check_ins_enabled: boolean }[]>`select check_ins_enabled from "user" where id = ${p.uid}`;
    expect(u!.check_ins_enabled).toBe(false);
  });

  it("changes the timezone once, clears the pass, and refuses a second change within 7 days", async () => {
    const p = await person();
    const res = await send("/api/account/time-zone", { timeZone: "Europe/London" }, p.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/astro\.pass=;.*Max-Age=0/);
    expect((await send("/api/account/time-zone", { timeZone: "Asia/Tokyo" }, p.cookie)).status).toBe(429);
  });

  it("signs out another device, but not this one", async () => {
    const p = await person();
    const me = await app.request("/api/me", { headers: { cookie: p.cookie } }, env);
    expect(passFrom(me)).toBeTruthy();
    const [mine] = await admin<{ id: string }[]>`select id from session where token = ${p.token}`;
    expect((await send("/api/account/sessions/revoke", { sessionId: mine!.id }, p.cookie)).status).toBe(400);
    await admin`insert into session (id, token, user_id, expires_at, surface) values ('other-device-' || ${p.uid}, 'tok-' || ${p.uid}, ${p.uid}, now() + interval '1 day', 'app')`;
    expect((await send("/api/account/sessions/revoke", { sessionId: `other-device-${p.uid}` }, p.cookie)).status).toBe(200);
    expect((await send("/api/account/sessions/revoke", { sessionId: "not-a-session" }, p.cookie)).status).toBe(404);
  });

  it("changes the password with the current one, and refuses a wrong one", async () => {
    const m = await member();
    expect((await send("/api/account/password", { currentPassword: "wrong password!", newPassword: "an entirely new passphrase" }, m.cookie)).status).toBe(400);
    await admin`insert into session (id, token, user_id, expires_at, surface) values ('pw-other-' || ${m.uid}, 'pw-tok-' || ${m.uid}, ${m.uid}, now() + interval '1 day', 'app')`;
    const ok = await send("/api/account/password", { currentPassword: PASSWORD, newPassword: "an entirely new passphrase" }, m.cookie);
    expect(ok.status).toBe(200);
    // This device stays signed in (with whatever cookie Better Auth set); every other device is signed out.
    const fresh = /astro\.session_token=([^;]+)/.exec(ok.headers.getSetCookie().join("\n"))?.[1];
    const cookie = fresh ? `astro.session_token=${fresh}` : m.cookie;
    expect((await app.request("/api/me", { headers: { cookie } }, env)).status).toBe(200);
    expect(await admin`select 1 from session where id = ${`pw-other-${m.uid}`}`).toHaveLength(0);
  });

  it("starts two-step setup with a QR code and backup codes", async () => {
    const m = await member();
    const res = await send("/api/account/two-step/enable", { password: PASSWORD }, m.cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { qr: string; secret: string; backupCodes: string[] };
    expect(body.qr).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(body.backupCodes.length).toBeGreaterThan(0);
  });

  it("deletes the account with the password and the word DELETE", async () => {
    const m = await member();
    expect((await send("/api/account/delete", { password: PASSWORD, confirm: "delete" }, m.cookie)).status).toBe(400);
    expect((await send("/api/account/delete", { password: PASSWORD, confirm: "DELETE" }, m.cookie)).status).toBe(200);
    expect(await admin`select 1 from "user" where id = ${m.uid}`).toHaveLength(0);
  });
});

describe("landing wording", () => {
  it("answers 204 before anything is published, then the published version", async () => {
    expect((await app.request("/api/copy/landing", {}, env)).status).toBe(204);
    await admin`insert into text_version (kind, snapshot, published_by) select 'landing', '{"landing.hero.title":"Hello"}'::jsonb, null`;
    const res = await app.request("/api/copy/landing", {}, env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { overrides: Record<string, string> }).overrides["landing.hero.title"]).toBe("Hello");
  });
});
