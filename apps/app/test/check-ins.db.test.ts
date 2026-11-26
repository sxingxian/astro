import { createDb, eq, schema } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dueCheckIns, saveCheckIn } from "@/lib/check-ins";
import { computePatterns } from "@/lib/patterns";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-26T04:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
let n = 0;

async function member(id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true });
  return id;
}

async function reading(userId: string, ago: number, spread: "one" | "three" = "one") {
  const at = daysAgo(ago);
  const [s] = await db
    .insert(schema.drawSession)
    .values({ userId, spread, localDay: `2026-02-${String((++n % 28) + 1).padStart(2, "0")}`, timeZone: "UTC", status: "complete", createdAt: at, completedAt: at })
    .returning({ id: schema.drawSession.id });
  const decks =
    spread === "one"
      ? [{ stage: "single" as const, order: ["the-tower"], picks: [0] }]
      : [
          { stage: "majors" as const, order: ["the-fool", "the-tower", "the-star"], picks: [0, 1, 2] },
          { stage: "minors" as const, order: ["ace-of-cups", "two-of-cups", "three-of-cups"], picks: [0, 1, 2] }
        ];
  for (const d of decks) await db.insert(schema.drawDeck).values({ sessionId: s!.id, stage: d.stage, order: d.order, orientations: d.order.map(() => "upright"), salt: "00", fingerprint: "0".repeat(32), picks: d.picks });
  return s!.id;
}

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("dueCheckIns", () => {
  it("is due from 7 to 30 days after a reading, oldest first", async () => {
    const u = await member("c-window");
    await reading(u, 6);
    const seven = await reading(u, 7);
    const twenty = await reading(u, 20);
    await reading(u, 31);
    const due = await dueCheckIns(db, u, now);
    expect(due.map((d) => d.sessionId)).toEqual([twenty, seven]);
    expect(due[0]?.cardId).toBe("the-tower");
  });

  it("names the Present Major for three pairs", async () => {
    const u = await member("c-three");
    await reading(u, 9, "three");
    expect((await dueCheckIns(db, u, now))[0]).toMatchObject({ cardId: "the-tower", position: "present" });
  });

  it("never asks again once answered or skipped, and not at all when turned off", async () => {
    const u = await member("c-done");
    const a = await reading(u, 8);
    const b = await reading(u, 9);
    await saveCheckIn(db, u, a, { outcome: "skipped" }, now);
    await saveCheckIn(db, u, b, { outcome: "fit", note: "The reshuffle was announced." }, now);
    expect(await dueCheckIns(db, u, now)).toEqual([]);
    await expect(saveCheckIn(db, u, b, { outcome: "not" }, now)).rejects.toMatchObject({ code: "already_done" });

    const off = await member("c-off");
    await reading(off, 10);
    await db.update(schema.user).set({ checkInsEnabled: false }).where(eq(schema.user.id, off));
    expect(await dueCheckIns(db, off, now)).toEqual([]);
  });

  it("refuses readings younger than 7 days and other people's readings", async () => {
    const u = await member("c-young");
    const other = await member("c-other");
    const young = await reading(u, 3);
    await expect(saveCheckIn(db, u, young, { outcome: "fit" }, now)).rejects.toMatchObject({ code: "too_soon" });
    const old = await reading(u, 12);
    await expect(saveCheckIn(db, other, old, { outcome: "fit" }, now)).rejects.toMatchObject({ code: "not_found" });
    await expect(saveCheckIn(db, u, old, { outcome: "fit", note: "x".repeat(501) }, now)).rejects.toMatchObject({ code: "too_long" });
  });

  it("feeds outcomes into Patterns", async () => {
    const u = await member("c-patterns");
    await saveCheckIn(db, u, await reading(u, 8), { outcome: "fit" }, now);
    await saveCheckIn(db, u, await reading(u, 9), { outcome: "not" }, now);
    expect((await computePatterns(db, u, "30d", now)).outcomes).toEqual({ fit: 1, partly: 0, not: 1 });
  });
});
