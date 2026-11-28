import { neonWsOverPostgres, resetAndMigrate } from "@astro/db/testing";
import { createWsDb } from "@astro/db/ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, freshIp, http, person, webUrl } from "./helpers";

let proxy: Awaited<ReturnType<typeof neonWsOverPostgres>>;
let limitOk = true;
const GUEST_DRAWS = { limit: async () => ({ success: limitOk }) };
// Draw starts go through the real Neon WebSocket driver (via the local proxy); reads through the HTTPS stand-in.
const app = createApp({ db: () => http, txDb: () => createWsDb(webUrl, { wsProxy: proxy.address }) });
const e = { ...env, GUEST_DRAWS };
const send = (path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body) }, e);

beforeAll(async () => {
  await resetAndMigrate(dbUrl);
  proxy = await neonWsOverPostgres();
});
afterAll(async () => {
  await proxy.close();
  await closeAll();
});

describe("draws over HTTPS only", () => {
  // The WebSocket client costs more processing time than Workers Free allows; starts use one database function.
  const noWs = createApp({
    db: () => http,
    txDb: () => {
      throw new Error("the WebSocket client must not be used");
    }
  });
  const post = (path: string, body: unknown, cookie?: string) =>
    noWs.request(path, { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }, e);

  it("a member starts, gets the same reading back, picks every stage and hits the daily limit", async () => {
    const p = await person();
    const start = await post("/api/draw/start", { spread: "three" }, p.cookie);
    expect(start.status).toBe(200);
    const s = (await start.json()) as { sessionId: string; status: string; timeZone: string; decks: { stage: string }[] };
    expect(s).toMatchObject({ status: "picking", timeZone: "Asia/Singapore" });
    expect(s.decks.map((d) => d.stage)).toEqual(["majors", "minors"]);
    expect(((await (await post("/api/draw/start", { spread: "three" }, p.cookie)).json()) as { sessionId: string }).sessionId).toBe(s.sessionId);
    expect(((await (await post("/api/draw/pick", { sessionId: s.sessionId, stage: "majors", positions: [0, 1, 2] }, p.cookie)).json()) as { status: string }).status).toBe("picking");
    const done = await post("/api/draw/pick", { sessionId: s.sessionId, stage: "minors", positions: [4, 5, 6] }, p.cookie);
    expect(((await done.json()) as { status: string; cards: unknown[] })).toMatchObject({ status: "complete" });
    // The same pick again returns the same cards; a different one is refused.
    expect((await post("/api/draw/pick", { sessionId: s.sessionId, stage: "minors", positions: [4, 5, 6] }, p.cookie)).status).toBe(200);
    expect((await post("/api/draw/pick", { sessionId: s.sessionId, stage: "minors", positions: [7, 8, 9] }, p.cookie)).status).toBe(409);
    expect((await post("/api/draw/start", { spread: "three" }, p.cookie)).status).toBe(409);
  });

  it("a guest starts a reading and the network's daily cap still applies", async () => {
    await admin`insert into app_setting (key, value) values ('guest_daily_cap', '1'::jsonb) on conflict (key) do update set value = excluded.value`;
    const first = await noWs.request("/api/draw/start", { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": "203.0.113.200" }, body: JSON.stringify({ spread: "one" }) }, e);
    expect(first.status).toBe(200);
    const second = await noWs.request("/api/draw/start", { method: "POST", headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": "203.0.113.200" }, body: JSON.stringify({ spread: "one" }) }, e);
    expect(second.status).toBe(429);
    await admin`delete from app_setting where key = 'guest_daily_cap'`;
  });
});

describe("draws", () => {
  it("a member starts today's reading, gets the same one back, picks, and reads it", async () => {
    const p = await person();
    const start = await send("/api/draw/start", { spread: "one" }, p.cookie);
    expect(start.status).toBe(200);
    const s = (await start.json()) as { sessionId: string; status: string; decks: unknown[] };
    expect(s.status).toBe("picking");
    expect(((await (await send("/api/draw/start", { spread: "one" }, p.cookie)).json()) as { sessionId: string }).sessionId).toBe(s.sessionId);

    const picked = await send("/api/draw/pick", { sessionId: s.sessionId, stage: "single", positions: [3] }, p.cookie);
    expect(picked.status).toBe(200);
    expect(((await picked.json()) as { status: string }).status).toBe("complete");

    const read = await app.request(`/api/draw/${s.sessionId}`, { headers: { cookie: p.cookie } }, e);
    expect(read.status).toBe(200);
    expect(((await read.json()) as { reveal?: unknown[] }).reveal).toBeDefined();
    // Done for today: a new start reports the daily limit.
    expect((await send("/api/draw/start", { spread: "one" }, p.cookie)).status).toBe(409);
  });

  it("two starts at the same moment still make one reading (the lock holds on the WebSocket client)", async () => {
    const p = await person();
    const [a, b] = await Promise.all([send("/api/draw/start", { spread: "three" }, p.cookie), send("/api/draw/start", { spread: "three" }, p.cookie)]);
    const ids = await Promise.all([a.json(), b.json()]).then((r) => r.map((x) => (x as { sessionId: string }).sessionId));
    expect(ids[0]).toBe(ids[1]);
  });

  it("a guest gets a guest cookie and a one-card reading; three cards need an account", async () => {
    const res = await send("/api/draw/start", { spread: "one", timeZone: "Asia/Singapore" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/astro_guest=/);
    expect((await send("/api/draw/start", { spread: "three" })).status).toBe(403);
  });

  it("a new guest reading is refused when the guest rate limit is used up", async () => {
    limitOk = false;
    try {
      expect((await send("/api/draw/start", { spread: "one" })).status).toBe(429);
    } finally {
      limitOk = true;
    }
  });

  it("refuses other sites, bad input and readings that aren't yours", async () => {
    const p = await person();
    expect((await send("/api/draw/start", { spread: "one" }, p.cookie, { origin: "https://evil.example" })).status).toBe(403);
    expect((await send("/api/draw/start", { spread: "seven" }, p.cookie)).status).toBe(400);
    const other = await person();
    const s = (await (await send("/api/draw/start", { spread: "one" }, other.cookie)).json()) as { sessionId: string };
    expect((await app.request(`/api/draw/${s.sessionId}`, { headers: { cookie: p.cookie } }, e)).status).toBe(404);
    expect((await send("/api/draw/pick", { sessionId: s.sessionId, stage: "single", positions: [1] }, p.cookie)).status).toBe(404);
  });
});
