import { createDb, schema } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JournalError, getNote, listReadings, setNote, setPrivate } from "@/lib/journal";
import { pick, startDraw, type Actor } from "@/lib/draw/service";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 4));

async function member(id: string): Promise<Actor & { kind: "user" }> {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, timeZone: "Asia/Singapore" });
  return { kind: "user", userId: id, timeZone: "Asia/Singapore" };
}

async function reading(a: Actor, n: number, spread: "one" | "three" = "one") {
  const s = await startDraw(db, a, spread, day(n));
  if (spread === "one") await pick(db, a, s.sessionId, "single", [n % 78], day(n));
  else {
    await pick(db, a, s.sessionId, "majors", [0, 1, 2], day(n));
    await pick(db, a, s.sessionId, "minors", [0, 1, 2], day(n));
  }
  return s.sessionId;
}

let alice: Actor & { kind: "user" };
let bob: Actor & { kind: "user" };
const ids: string[] = [];

beforeAll(async () => {
  await resetAndMigrate(url);
  alice = await member("alice");
  bob = await member("bob");
  for (let n = 0; n < 25; n++) ids.push(await reading(alice, n, n % 5 === 0 ? "three" : "one"));
  // An unfinished reading never shows in the journal.
  await startDraw(db, alice, "one", day(40));
});
afterAll(async () => {
  await db.$client.end();
});

describe("listReadings", () => {
  it("lists completed readings newest first, with cursor paging", async () => {
    const first = await listReadings(db, alice.userId, { filter: "all" });
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.id).toBe(ids[24]);
    expect(first.nextCursor).toBeTruthy();
    const second = await listReadings(db, alice.userId, { filter: "all", cursor: first.nextCursor ?? undefined });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual([...ids].reverse());
  });

  it("filters by spread and names the cards", async () => {
    const three = await listReadings(db, alice.userId, { filter: "three" });
    expect(three.items).toHaveLength(5);
    expect(three.items[0]?.cardNames).toHaveLength(3);
    const one = await listReadings(db, alice.userId, { filter: "one" });
    expect(one.items.every((i) => i.spread === "one" && i.cardNames.length === 1)).toBe(true);
  });

  it("ignores a malformed cursor", async () => {
    const r = await listReadings(db, alice.userId, { filter: "all", cursor: "not-a-cursor" });
    expect(r.items).toHaveLength(20);
  });
});

describe("notes and privacy", () => {
  it("saves, shows and clears a note", async () => {
    await setNote(db, alice.userId, ids[3]!, "Felt calmer after the walk.");
    expect(await getNote(db, alice.userId, ids[3]!)).toBe("Felt calmer after the walk.");
    const list = await listReadings(db, alice.userId, { filter: "all", cursor: undefined });
    expect([...list.items].find((i) => i.id === ids[3]) ?? (await listReadings(db, alice.userId, { filter: "all", cursor: list.nextCursor ?? undefined })).items.find((i) => i.id === ids[3])).toMatchObject({ note: "Felt calmer after the walk." });
    await setNote(db, alice.userId, ids[3]!, "   ");
    expect(await getNote(db, alice.userId, ids[3]!)).toBeNull();
  });

  it("rejects a note over 2000 characters", async () => {
    await expect(setNote(db, alice.userId, ids[4]!, "x".repeat(2001))).rejects.toMatchObject({ code: "too_long" });
  });

  it("refuses another person's reading", async () => {
    await expect(setNote(db, bob.userId, ids[5]!, "mine now")).rejects.toBeInstanceOf(JournalError);
    await expect(setPrivate(db, bob.userId, ids[5]!, true)).rejects.toMatchObject({ code: "not_found" });
    expect((await listReadings(db, bob.userId, { filter: "all" })).items).toHaveLength(0);
  });

  it("marks a reading private", async () => {
    await setPrivate(db, alice.userId, ids[6]!, true);
    const all = [...(await listReadings(db, alice.userId, { filter: "all" })).items, ...(await listReadings(db, alice.userId, { filter: "all", cursor: (await listReadings(db, alice.userId, { filter: "all" })).nextCursor ?? undefined })).items];
    expect(all.find((i) => i.id === ids[6])?.private).toBe(true);
  });
});
