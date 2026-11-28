import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteEntry, exportCsv, getEntry, listEntries, saveEntry } from "@/lib/reader-log";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);

const pos = (label: string, id: string, reversed = false) => ({ label, card: { id, reversed } });
const valid = {
  readOn: "2026-11-26",
  place: "in_person",
  name: "Hannah",
  question: "Should I go back to school?",
  notes: "Torn between security and growth.",
  consent: true,
  spread: "three_any",
  cards: { positions: [pos("Past", "the-hermit"), pos("Present", "justice", true), pos("Future", "the-star")], extras: [{ card: { id: "eight-of-cups", reversed: false }, attachedTo: 1 }] }
};

beforeAll(async () => {
  await resetAndMigrate(url);
  await db.$client`insert into "user" (id, name, email, email_verified) values ('ra', 'ra', 'ra@example.com', true), ('rb', 'rb', 'rb@example.com', true), ('plain', 'p', 'p@example.com', true)`;
  await db.$client`insert into reader_role (user_id) values ('ra'), ('rb')`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("a reader's log", () => {
  let aId = "";

  it("saves, lists and exports a reader's own entries", async () => {
    aId = await saveEntry(db, "ra", valid);
    const list = await listEntries(db, "ra", {});
    expect(list.items.map((e) => e.id)).toEqual([aId]);
    expect(list.items[0]).toMatchObject({ name: "Hannah", spread: "three_any", place: "in_person" });
    const out = await exportCsv(db, "ra");
    expect(out.csv).toContain("Hannah");
    expect(out.csv).toContain('"26 Nov 2026"'); // the one date format, in the download too
    expect(out.csv).not.toContain("2026-11-26");
    expect(out.rows).toBeGreaterThan(0);
    expect((await listEntries(db, "rb", {})).items).toHaveLength(0);
  });

  it("hides one reader's entries from another: not found, never forbidden", async () => {
    await expect(getEntry(db, "rb", aId)).rejects.toMatchObject({ status: 404 });
    await expect(saveEntry(db, "rb", { ...valid, name: "Taken" }, aId)).rejects.toMatchObject({ status: 404 });
    await expect(deleteEntry(db, "rb", aId)).rejects.toMatchObject({ status: 404 });
    expect((await getEntry(db, "ra", aId)).name).toBe("Hannah");
  });

  it("refuses everyone without the reader role", async () => {
    await expect(listEntries(db, "plain", {})).rejects.toMatchObject({ status: 403 });
    await expect(saveEntry(db, "plain", valid)).rejects.toMatchObject({ status: 403 });
  });

  it("locks the log while the role is removed, keeps the rows, and unlocks it when the role comes back", async () => {
    await db.$client`update reader_role set revoked_at = now() where user_id = 'ra'`;
    await expect(listEntries(db, "ra", {})).rejects.toMatchObject({ status: 403 });
    await expect(getEntry(db, "ra", aId)).rejects.toMatchObject({ status: 403 });
    await expect(exportCsv(db, "ra")).rejects.toMatchObject({ status: 403 });
    await expect(deleteEntry(db, "ra", aId)).rejects.toMatchObject({ status: 403 });
    const [kept] = await db.$client<{ n: number }[]>`select count(*)::int as n from reader_log_entry where reader_id = 'ra'`;
    expect(kept!.n).toBe(1);
    await db.$client`update reader_role set revoked_at = null where user_id = 'ra'`;
    expect((await listEntries(db, "ra", {})).items).toHaveLength(1);
  });

  it("refuses unknown cards, the wrong number of positions, long names, contact details and missing consent", async () => {
    const bad = [
      { ...valid, cards: { ...valid.cards, positions: [pos("Past", "not-a-card"), valid.cards.positions[1], valid.cards.positions[2]] } },
      { ...valid, cards: { ...valid.cards, positions: [...valid.cards.positions, pos("Advice", "the-sun")] } },
      { ...valid, name: "x".repeat(61) },
      { ...valid, name: "ann@example.com" },
      { ...valid, consent: undefined },
      { ...valid, consent: false },
      { ...valid, cards: { ...valid.cards, positions: [pos("Past", "the-star"), valid.cards.positions[1], valid.cards.positions[2]] } },
      { ...valid, spread: "three_pairs" },
      { ...valid, cards: { ...valid.cards, extras: [{ card: { id: "the-sun", reversed: false }, attachedTo: 3 }] } }
    ];
    for (const b of bad) await expect(saveEntry(db, "ra", b)).rejects.toMatchObject({ status: 400 });
  });

  it("takes a Major and a Minor clarifier per position for three pairs", async () => {
    const pair = (label: string, major: string, minor: string) => ({ label, card: { id: major, reversed: false }, clarifier: { id: minor, reversed: true } });
    const id = await saveEntry(db, "ra", { ...valid, spread: "three_pairs", cards: { positions: [pair("Past", "the-fool", "two-of-cups"), pair("Present", "the-moon", "ace-of-wands"), pair("Future", "the-sun", "king-of-swords")], extras: [] } });
    expect((await getEntry(db, "ra", id)).cards.positions[0]!.clarifier).toEqual({ id: "two-of-cups", reversed: true });
    await expect(saveEntry(db, "ra", { ...valid, spread: "three_pairs", cards: { positions: [pair("Past", "two-of-cups", "the-fool"), pair("Present", "the-moon", "ace-of-wands"), pair("Future", "the-sun", "king-of-swords")], extras: [] } })).rejects.toMatchObject({ status: 400 });
  });

  it("lets the reader edit and delete their own entry", async () => {
    await saveEntry(db, "ra", { ...valid, notes: "Edited" }, aId);
    expect((await getEntry(db, "ra", aId)).notes).toBe("Edited");
    await deleteEntry(db, "ra", aId);
    await expect(getEntry(db, "ra", aId)).rejects.toMatchObject({ status: 404 });
  });

  it("goes with the account", async () => {
    await saveEntry(db, "rb", valid);
    await db.$client`delete from "user" where id = 'rb'`;
    const [left] = await db.$client<{ n: number }[]>`select count(*)::int as n from reader_log_entry where reader_id = 'rb'`;
    expect(left!.n).toBe(0);
  });
});
