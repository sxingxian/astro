import { createDb, eq, schema, sql } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { verifyCommitment } from "@astro/draw";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrawError } from "@/lib/draw/errors";
import { getReading, pick, startDraw, type Actor } from "@/lib/draw/service";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);

const noon = new Date("2026-11-26T04:00:00Z"); // 12:00 in Singapore
let n = 0;

async function member(timeZone = "Asia/Singapore"): Promise<Actor & { kind: "user" }> {
  const id = `u-${++n}-${Date.now()}`;
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, timeZone });
  return { kind: "user", userId: id, timeZone };
}
const guest = (tag = `${++n}`, timeZone = "Asia/Singapore", ipHash = `ip-${tag}`): Actor => ({ kind: "guest", guestHash: `g-${tag}-${Date.now()}`, ipHash, timeZone });

async function errorOf(p: Promise<unknown>): Promise<DrawError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof DrawError) return e;
    throw e;
  }
  throw new Error("expected a DrawError");
}

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("startDraw", () => {
  it("returns the same session when started twice", async () => {
    const a = await member();
    const first = await startDraw(db, a, "one", noon);
    const again = await startDraw(db, a, "one", noon);
    expect(again.sessionId).toBe(first.sessionId);
    expect(first.decks).toEqual([{ stage: "single", size: 78, fingerprint: expect.stringMatching(/^[0-9a-f]{32}$/), picks: [], cards: [] }]);
  });

  it("creates exactly one session under concurrent starts", async () => {
    const a = await member();
    const results = await Promise.all(Array.from({ length: 10 }, () => startDraw(db, a, "three", noon)));
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(1);
    const rows = await db.select().from(schema.drawSession).where(eq(schema.drawSession.userId, a.userId));
    expect(rows).toHaveLength(1);
    const decks = await db.select().from(schema.drawDeck).where(eq(schema.drawDeck.sessionId, rows[0]!.id));
    expect(decks.map((d) => d.stage).sort()).toEqual(["majors", "minors"]);
  });

  it("refuses the three-pair spread to guests", async () => {
    expect((await errorOf(startDraw(db, guest(), "three", noon))).code).toBe("guest_spread");
  });

  it("opens a new reading on the next local day", async () => {
    const a = await member();
    const first = await startDraw(db, a, "one", noon);
    await pick(db, a, first.sessionId, "single", [5], noon);
    const tomorrow = new Date(noon.getTime() + 24 * 3600_000);
    const next = await startDraw(db, a, "one", tomorrow);
    expect(next.sessionId).not.toBe(first.sessionId);
  });

  it("blocks a second reading after a completed one, with the reset time", async () => {
    const a = await member();
    const s = await startDraw(db, a, "one", noon);
    await pick(db, a, s.sessionId, "single", [0], noon);
    const err = await errorOf(startDraw(db, a, "one", new Date(noon.getTime() + 3600_000)));
    expect(err.code).toBe("daily_limit");
    expect(err.details).toMatchObject({ sessionId: s.sessionId, resetsAt: "2026-11-26T16:00:00.000Z" });
  });

  it("keeps the limit when a member's timezone changes mid-day", async () => {
    const a = await member("Asia/Singapore");
    const s = await startDraw(db, a, "one", noon);
    await pick(db, a, s.sessionId, "single", [1], noon);
    // On Kiritimati (UTC+14) it is already the 27th, but the reading's Singapore day has not ended.
    const moved = { ...a, timeZone: "Pacific/Kiritimati" };
    expect((await errorOf(startDraw(db, moved, "one", new Date("2026-11-26T12:00:00Z")))).code).toBe("daily_limit");
  });

  it("keeps the limit when a guest sends a different timezone", async () => {
    const g = guest("tz");
    const s = await startDraw(db, g, "one", noon);
    await pick(db, g, s.sessionId, "single", [2], noon);
    expect((await errorOf(startDraw(db, { ...g, timeZone: "Pacific/Kiritimati" }, "one", new Date("2026-11-26T12:00:00Z")))).code).toBe("daily_limit");
  });

  it("caps guest readings from one network at 3 a day", async () => {
    const ip = `ip-cap-${Date.now()}`;
    for (let i = 0; i < 3; i++) await startDraw(db, guest(`cap${i}`, "UTC", ip), "one", noon);
    expect((await errorOf(startDraw(db, guest("cap3", "UTC", ip), "one", noon))).code).toBe("rate_limited");
  });

  it("deletes guest readings older than 48 hours on the next guest start", async () => {
    const old = guest("old");
    const past = new Date(noon.getTime() - 3 * 24 * 3600_000);
    const s = await startDraw(db, old, "one", past);
    await db.update(schema.drawSession).set({ createdAt: past }).where(eq(schema.drawSession.id, s.sessionId));
    await startDraw(db, guest("trigger"), "one", noon);
    const left = await db.select().from(schema.drawSession).where(eq(schema.drawSession.id, s.sessionId));
    expect(left).toHaveLength(0);
  });
});

describe("pick", () => {
  it("rejects bad positions", async () => {
    const a = await member();
    const s = await startDraw(db, a, "three", noon);
    for (const positions of [[1, 1, 2], [0, 1, 22], [-1, 0, 1], [0, 1], [0.5, 1, 2]]) {
      expect((await errorOf(pick(db, a, s.sessionId, "majors", positions, noon))).code).toBe("bad_positions");
    }
  });

  it("requires Majors before Minors", async () => {
    const a = await member();
    const s = await startDraw(db, a, "three", noon);
    expect((await errorOf(pick(db, a, s.sessionId, "minors", [0, 1, 2], noon))).code).toBe("wrong_stage");
    expect((await errorOf(pick(db, a, s.sessionId, "single", [0], noon))).code).toBe("wrong_stage");
  });

  it("returns the same cards for a repeated pick and refuses a different one", async () => {
    const a = await member();
    const s = await startDraw(db, a, "three", noon);
    const results = await Promise.all(Array.from({ length: 10 }, () => pick(db, a, s.sessionId, "majors", [3, 7, 11], noon)));
    for (const r of results) expect(r).toEqual(results[0]);
    expect(results[0]?.cards).toHaveLength(3);
    expect((await errorOf(pick(db, a, s.sessionId, "majors", [1, 2, 4], noon))).code).toBe("stage_done");
  });

  it("hides another person's reading", async () => {
    const a = await member();
    const b = await member();
    const s = await startDraw(db, a, "one", noon);
    expect((await errorOf(pick(db, b, s.sessionId, "single", [0], noon))).code).toBe("not_found");
    expect((await errorOf(getReading(db, b, s.sessionId, noon))).code).toBe("not_found");
  });
});

describe("getReading", () => {
  it("never reveals the deck before the reading is complete", async () => {
    const sizes = new Set([22, 56, 78]);
    const hasDeckArray = (v: unknown): boolean => (Array.isArray(v) ? sizes.has(v.length) || v.some(hasDeckArray) : v !== null && typeof v === "object" ? Object.values(v).some(hasDeckArray) : false);
    for (let i = 0; i < 200; i++) {
      const g = guest(`leak${i}`, "UTC", `ip-leak-${i}`);
      const s = await startDraw(db, g, "one", noon);
      for (const payload of [s, await getReading(db, g, s.sessionId, noon)]) {
        const json = JSON.stringify(payload);
        expect(json).not.toMatch(/"(order|orientations|salt)"/);
        expect(hasDeckArray(payload)).toBe(false);
      }
    }
  });

  it("reveals order, orientations and salt that verify, once complete", async () => {
    const a = await member();
    const s = await startDraw(db, a, "three", noon);
    await pick(db, a, s.sessionId, "majors", [0, 1, 2], noon);
    const mid = await getReading(db, a, s.sessionId, noon);
    expect(mid.status).toBe("picking");
    expect(mid.reveal).toBeUndefined();
    await pick(db, a, s.sessionId, "minors", [10, 20, 30], noon);
    const done = await getReading(db, a, s.sessionId, noon);
    expect(done.status).toBe("complete");
    expect(done.reveal).toHaveLength(2);
    for (const r of done.reveal ?? []) {
      const deck = done.decks.find((d) => d.stage === r.stage);
      expect(await verifyCommitment(r.order, r.orientations, r.salt, deck?.fingerprint ?? "")).toBe(true);
    }
    expect(done.decks.find((d) => d.stage === "majors")?.cards.map((c) => c.cardId)).toEqual(done.reveal?.find((r) => r.stage === "majors")?.order.slice(0, 3));
  });

  it("uses the reversal rate from settings", async () => {
    await db.execute(sql`update app_setting set value = '1'::jsonb where key = 'reversal_rate'`);
    const a = await member();
    const s = await startDraw(db, a, "one", noon);
    const r = await pick(db, a, s.sessionId, "single", [4], noon);
    expect(r.cards[0]?.orientation).toBe("reversed");
    await db.execute(sql`update app_setting set value = '0.3'::jsonb where key = 'reversal_rate'`);
  });
});

describe("review fixes", () => {
  it("returns today's reading to a member who moved west instead of failing", async () => {
    const a = await member("Asia/Singapore");
    const at = new Date("2026-11-25T16:30:00Z"); // 00:30 on the 26th in Singapore
    const s = await startDraw(db, a, "one", at);
    const la = { ...a, timeZone: "America/Los_Angeles" };
    const later = new Date("2026-11-26T18:00:00Z"); // 10:00 on the 26th in Los Angeles
    const again = await startDraw(db, la, "one", later);
    expect(again.sessionId).toBe(s.sessionId);
    await pick(db, la, s.sessionId, "single", [9], later);
    expect((await errorOf(startDraw(db, la, "one", later))).code).toBe("daily_limit");
  });

  it("creates one guest reading even when two timezones race", async () => {
    const tag = `race-${Date.now()}`;
    const base = guest(tag, "UTC", `ip-${tag}`);
    const results = await Promise.all(
      ["Pacific/Kiritimati", "Etc/GMT+12", "Asia/Singapore", "America/New_York"].map((timeZone) => startDraw(db, { ...base, timeZone }, "one", noon))
    );
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(1);
  });
});
