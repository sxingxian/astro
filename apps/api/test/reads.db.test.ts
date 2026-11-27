import { dueCheckIns } from "@astro/app-core/check-ins";
import { findToday, getReading, pick, startDraw } from "@astro/app-core/draw/service";
import { getNote, listReadings, setNote } from "@astro/app-core/journal";
import { computePatterns } from "@astro/app-core/patterns";
import { readerStatus } from "@astro/app-core/readers";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, fake, http, passFrom, person, tcp } from "./helpers";

const app = createApp({ db: () => http, txDb: () => ({ db: tcp, end: async () => {} }) });
const get = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} }, env);
const json = (x: unknown) => JSON.parse(JSON.stringify(x));

/** A member with history: two finished readings 8 and 12 days old (check-ins due), a note, and one today. */
async function memberWithHistory() {
  const p = await person();
  const actor = { kind: "user" as const, userId: p.uid, timeZone: "Asia/Singapore" };
  const ids: string[] = [];
  for (const days of [12, 8]) {
    const at = new Date(Date.now() - days * 86_400_000);
    const s = await startDraw(tcp, actor, "one", at);
    await pick(tcp, actor, s.sessionId, "single", [days], at);
    ids.push(s.sessionId);
  }
  await setNote(tcp, p.uid, ids[0]!, "Steady, slow change.");
  await startDraw(tcp, actor, "three");
  return { ...p, actor, ids };
}

/** Calls an endpoint with a live pass and returns its JSON and the number of database requests it made. */
async function measured(path: string, cookie: string) {
  const warm = await get(path.startsWith("/api/session") ? "/api/session" : "/api/me", cookie);
  const withPass = `${cookie}; astro.pass=${passFrom(warm)}`;
  await get("/api/session", withPass); // wording now cached in this isolate
  const before = fake.calls();
  const res = await get(path, withPass);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test reads arbitrary JSON shapes
  return { status: res.status, body: (await res.json()) as any, requests: fake.calls() - before };
}

beforeAll(async () => {
  await resetAndMigrate(dbUrl);
});
afterAll(closeAll);

describe("screen reads: same data as the Next.js pages, one database request each", () => {
  it("Today", async () => {
    const m = await memberWithHistory();
    const r = await measured("/api/today", m.cookie);
    expect(r.status).toBe(200);
    expect(r.body).toEqual(
      json({ signedIn: true, one: await findToday(tcp, m.actor, "one"), three: await findToday(tcp, m.actor, "three"), due: await dueCheckIns(tcp, m.uid), recent: (await listReadings(tcp, m.uid, { limit: 3 })).items, reader: await readerStatus(tcp, m.uid) })
    );
    expect(r.body.due.length).toBe(2);
    expect(r.requests).toBe(1);
  });

  it("Journal, with its filter and the next page", async () => {
    const m = await memberWithHistory();
    const r = await measured("/api/journal?filter=one", m.cookie);
    expect(r.body).toEqual(json(await listReadings(tcp, m.uid, { filter: "one" })));
    expect(r.body.items).toHaveLength(2);
    expect(r.requests).toBe(1);
  });

  it("Patterns", async () => {
    const m = await memberWithHistory();
    const r = await measured("/api/patterns?range=90d", m.cookie);
    expect(r.body).toEqual(json(await computePatterns(tcp, m.uid, "90d")));
    expect(r.requests).toBe(1);
  });

  it("a reading with its note; someone else's reading is not found", async () => {
    const m = await memberWithHistory();
    const r = await measured(`/api/reading/${m.ids[0]}`, m.cookie);
    expect(r.body).toEqual(json({ reading: await getReading(tcp, m.actor, m.ids[0]!), note: await getNote(tcp, m.uid, m.ids[0]!) }));
    expect(r.body.reading.reveal).toBeDefined();
    expect(r.requests).toBe(1);
    const other = await person();
    expect((await get(`/api/reading/${m.ids[0]}`, other.cookie)).status).toBe(404);
    expect((await get("/api/reading/not-a-uuid", other.cookie)).status).toBe(404);
  });

  it("Account", async () => {
    const m = await memberWithHistory();
    const r = await measured("/api/account", m.cookie);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ id: m.uid, email: `${m.uid}@example.com`, checkInsEnabled: true, twoFactorEnabled: false });
    expect(r.body.sessions).toHaveLength(1);
    expect(r.requests).toBe(1);
  });

  it("a check-in that is due; one that isn't is not found", async () => {
    const m = await memberWithHistory();
    const r = await measured(`/api/check-in/${m.ids[1]}`, m.cookie);
    expect(r.body).toEqual(json((await dueCheckIns(tcp, m.uid, new Date(), 50)).find((d) => d.sessionId === m.ids[1])));
    expect(r.requests).toBe(1);
    expect((await get("/api/check-in/00000000-0000-0000-0000-000000000000", m.cookie)).status).toBe(404);
  });

  it("the session: signed out, then signed in, with wording and the maintenance state", async () => {
    const out = await get("/api/session");
    expect(out.status).toBe(200);
    expect(await out.json()).toMatchObject({ user: null, wording: { app: {}, meanings: {} }, maintenance: { on: false }, preview: false, config: { turnstileMode: "off", turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY } });
    const m = await person();
    const r = await measured("/api/session", m.cookie);
    expect(r.body.user).toMatchObject({ id: m.uid, timeZone: "Asia/Singapore", reader: false });
    // A pass and cached wording: no database request at all.
    expect(r.requests).toBe(0);
  });

  it("terms and privacy are public", async () => {
    const res = await get("/api/legal/terms");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { doc?: unknown }).doc).toBeDefined();
    expect((await get("/api/legal/cookies")).status).toBe(404);
  });

  it("the preview bar shows only while the preview link is current, whatever it previews", async () => {
    await admin`insert into text_preview (id, kind, snapshot, expires_at) values ('reads-live-terms-00000', 'terms', '{}'::jsonb, now() + interval '30 minutes'), ('reads-old-app-00000000', 'app', '{"app.sign_in.title":"Stale"}'::jsonb, now() - interval '1 minute')`;
    const live = (await (await get("/api/session?astro-preview=reads-live-terms-00000")).json()) as { preview: boolean };
    const old = (await (await get("/api/session?astro-preview=reads-old-app-00000000")).json()) as { preview: boolean; wording: { app: Record<string, string> } };
    expect(live.preview).toBe(true);
    expect(old.preview).toBe(false);
    expect(old.wording.app["app.sign_in.title"]).toBeUndefined();
  });

  it("signed out: every member screen is 401", async () => {
    for (const path of ["/api/journal", "/api/patterns", "/api/account", "/api/check-in/x"]) expect((await get(path)).status).toBe(401);
    // Today is for guests too: signed out, it shows only a guest's one-card reading (none here).
    expect(await (await get("/api/today")).json()).toEqual({ signedIn: false, one: null, three: null, due: [], recent: [], reader: null });
  });

  it("a guest who drew today sees that reading on Today, found by their guest cookie", async () => {
    const start = await app.request("/api/draw/start", { method: "POST", headers: { "content-type": "application/json", origin: env.APP_URL, "cf-connecting-ip": "203.0.113.77" }, body: JSON.stringify({ spread: "one", timeZone: "Asia/Singapore" }) }, env);
    expect(start.status).toBe(200);
    const guest = start.headers.getSetCookie().find((c) => c.startsWith("astro_guest="))!.split(";")[0]!;
    const { sessionId } = (await start.json()) as { sessionId: string };
    const body = (await (await get("/api/today", guest)).json()) as { signedIn: boolean; one: { sessionId: string } | null; three: unknown };
    expect(body).toMatchObject({ signedIn: false, three: null, one: { sessionId } });
  });

  it("while paused: 503 everywhere except health, the landing wording and the session", async () => {
    await admin`insert into app_setting (key, value) values ('maintenance_mode', 'true'::jsonb) on conflict (key) do update set value = excluded.value`;
    try {
      const m = await person();
      const now = { ...env, MAINTENANCE_CACHE_SECONDS: "0" };
      const at = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} }, now);
      expect((await at("/api/today", m.cookie)).status).toBe(503);
      expect((await at("/api/health")).status).toBe(200);
      expect((await at("/api/copy/landing")).status).not.toBe(503);
      expect(((await (await at("/api/session")).json()) as { maintenance: { on: boolean } }).maintenance.on).toBe(true);
    } finally {
      await admin`update app_setting set value = 'false'::jsonb where key = 'maintenance_mode'`;
      await app.request("/api/session", {}, { ...env, MAINTENANCE_CACHE_SECONDS: "0" }); // re-read, so later tests see it unpaused
    }
  });
});
