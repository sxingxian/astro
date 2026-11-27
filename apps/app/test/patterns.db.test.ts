import { createDb, schema } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computePatterns } from "@/lib/patterns";
import { loadCopy } from "@/lib/copy";
import { patternsCopy } from "@/lib/patterns-copy";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-26T04:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

let n = 0;
/** Inserts a completed reading whose picked cards are exactly `cards` (with optional orientations). */
async function seed(userId: string, cards: string[], { ago = 1, reversed = [] as number[], private: priv = false, outcome }: { ago?: number; reversed?: number[]; private?: boolean; outcome?: "fit" | "partly" | "not" | "skipped" } = {}) {
  const at = daysAgo(ago);
  const spread = cards.length === 1 ? "one" : "three";
  const [s] = await db
    .insert(schema.drawSession)
    .values({ userId, spread, localDay: `2026-01-${String((++n % 28) + 1).padStart(2, "0")}`, timeZone: "UTC", status: "complete", private: priv, createdAt: at, completedAt: at })
    .returning({ id: schema.drawSession.id });
  const decks = spread === "one" ? [{ stage: "single" as const, cards }] : [{ stage: "majors" as const, cards: cards.slice(0, 3) }, { stage: "minors" as const, cards: cards.slice(3) }];
  for (const d of decks) {
    await db.insert(schema.drawDeck).values({
      sessionId: s!.id,
      stage: d.stage,
      order: d.cards,
      orientations: d.cards.map((_, i) => (reversed.includes(i + (d.stage === "minors" ? 3 : 0)) ? "reversed" : "upright")),
      salt: "00",
      fingerprint: "0".repeat(32),
      picks: d.cards.map((_, i) => i)
    });
  }
  if (outcome) await db.insert(schema.checkIn).values({ sessionId: s!.id, outcome });
  return s!.id;
}

async function member(id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true });
  return id;
}

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("computePatterns", () => {
  it("finds cards that keep returning", async () => {
    const u = await member("p-repeat");
    await seed(u, ["the-star"], { ago: 1 });
    await seed(u, ["the-star"], { ago: 3 });
    await seed(u, ["the-star"], { ago: 5 });
    await seed(u, ["the-tower"], { ago: 2 });
    await seed(u, ["the-tower"], { ago: 4 });
    await seed(u, ["ace-of-cups"], { ago: 6 });
    const p = await computePatterns(db, u, "30d", now);
    expect(p.readings).toBe(6);
    expect(p.repeats).toEqual([{ cardId: "the-star", count: 3 }, { cardId: "the-tower", count: 2 }]);
  });

  it("leaves out private readings and readings outside the range", async () => {
    const u = await member("p-range");
    await seed(u, ["the-moon"], { ago: 2 });
    await seed(u, ["the-moon"], { ago: 3, private: true });
    await seed(u, ["the-moon"], { ago: 40 });
    expect((await computePatterns(db, u, "30d", now)).readings).toBe(1);
    expect((await computePatterns(db, u, "90d", now)).readings).toBe(2);
    expect((await computePatterns(db, u, "all", now)).repeats).toEqual([{ cardId: "the-moon", count: 2 }]);
  });

  it("counts Minor suits as elements, the Major share and reversals", async () => {
    const u = await member("p-elements");
    await seed(u, ["the-sun", "the-star", "the-moon", "two-of-cups", "ace-of-cups", "five-of-wands"], { reversed: [0, 4] });
    await seed(u, ["three-of-cups"]);
    const p = await computePatterns(db, u, "30d", now);
    expect(p.cards).toBe(7);
    expect(p.elements).toEqual([{ suit: "cups", count: 3 }, { suit: "wands", count: 1 }, { suit: "swords", count: 0 }, { suit: "pentacles", count: 0 }]);
    expect(p.majorShare).toBe(43);
    expect(p.reversed).toEqual({ count: 2, of: 7 });
  });

  it("feeds check-in outcomes in, and counts readings old enough for one", async () => {
    const u = await member("p-checkins");
    await seed(u, ["the-fool"], { ago: 10, outcome: "fit" });
    await seed(u, ["the-fool"], { ago: 11, outcome: "partly" });
    await seed(u, ["the-fool"], { ago: 12, outcome: "skipped" });
    await seed(u, ["the-fool"], { ago: 13 });
    await seed(u, ["the-fool"], { ago: 2 });
    const p = await computePatterns(db, u, "30d", now);
    expect(p.outcomes).toEqual({ fit: 1, partly: 1, not: 0 });
    expect(p.checkedIn).toEqual({ done: 2, eligible: 4 });
  });

  it("is empty for someone with no readings", async () => {
    const u = await member("p-empty");
    const p = await computePatterns(db, u, "30d", now);
    expect(p).toMatchObject({ readings: 0, cards: 0, repeats: [], majorShare: 0, reversed: { count: 0, of: 0 } });
  });
});

describe("Majors with -of- in their names", () => {
  it("counts Wheel of Fortune as a Major", async () => {
    const u = await member("p-wheel");
    await seed(u, ["wheel-of-fortune"]);
    const p = await computePatterns(db, u, "30d", now);
    expect(p.majorShare).toBe(100);
    expect(p.elements.every((e) => e.count === 0)).toBe(true);
  });
});

describe("patternsCopy", () => {
  it("names the leading element for the range", async () => {
    const u = await member("p-copy");
    for (let i = 0; i < 3; i++) await seed(u, ["two-of-cups"], { ago: i + 1 });
    const copy = patternsCopy(await computePatterns(db, u, "30d", now), "30d", await loadCopy(db, { cache: false }));
    expect(copy.elementsTitle).toBe("Water leads this month");
    expect(copy.repeatsTitle).toBe("Two of Cups has come up three times");
  });

  it("asks for patience with fewer than three readings", async () => {
    const u = await member("p-few");
    await seed(u, ["the-hermit"]);
    const copy = patternsCopy(await computePatterns(db, u, "30d", now), "30d", await loadCopy(db, { cache: false }));
    expect(copy.repeatsTitle).toBe("Patterns appear after a few readings");
    expect(copy.elementsTitle).toBe("Patterns appear after a few readings");
  });
});
