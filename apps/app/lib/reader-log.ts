import { allCards, getCard } from "@astro/cards";
import { sql, type Db } from "@astro/db";
import { HttpError } from "@astro/server";
import { z } from "zod";
import { readerStatus } from "./readers";

const CARD_IDS = new Set(allCards.map((c) => c.id));
const PageSize = 30;

const CardPick = z.object({ id: z.string().refine((id) => CARD_IDS.has(id)), reversed: z.boolean() });
const Position = z.object({ label: z.string().trim().min(1).max(30), card: CardPick, clarifier: CardPick.optional() });

/** The cards of one entry: 1 or 3 positions (three pairs: a Major and a Minor clarifier each), up to 6 accompanying cards. */
export const LogCards = z.object({
  positions: z.array(Position).min(1).max(3),
  extras: z.array(z.object({ card: CardPick, attachedTo: z.number().int().min(0).max(2).nullable() })).max(6)
});
export type LogCards = z.infer<typeof LogCards>;

// "First name or nickname only": refuse anything that looks like an email address or a phone number.
const noContact = (s: string) => !/@/.test(s) && !/(\d[\s().-]*){7,}/.test(s);

export const LogInput = z
  .object({
    readOn: z.iso.date(),
    place: z.enum(["in_person", "online", "event"]),
    name: z.string().trim().min(1).max(60).refine(noContact),
    question: z.string().trim().max(280).optional().transform((v) => v || null),
    notes: z.string().trim().max(4000).optional().transform((v) => v || null),
    consent: z.literal(true),
    spread: z.enum(["one", "three_any", "three_pairs"]),
    cards: LogCards
  })
  .superRefine((v, ctx) => {
    const p = v.cards.positions;
    const bad = (message: string) => ctx.addIssue({ code: "custom", message });
    if (p.length !== (v.spread === "one" ? 1 : 3)) bad("positions");
    const pairs = v.spread === "three_pairs";
    for (const pos of p) {
      if (pairs !== Boolean(pos.clarifier)) bad("clarifier");
      if (pairs && pos.clarifier && (getCard(pos.card.id).arcana !== "major" || getCard(pos.clarifier.id).arcana !== "minor")) bad("pairs");
    }
    for (const e of v.cards.extras) if (e.attachedTo !== null && e.attachedTo >= p.length) bad("attachedTo");
    // One physical deck: a card can't come up twice in the same reading.
    const ids = [...p.flatMap((x) => [x.card.id, x.clarifier?.id]), ...v.cards.extras.map((e) => e.card.id)].filter(Boolean);
    if (new Set(ids).size !== ids.length) bad("duplicate");
    if (v.readOn > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) bad("future");
  });
export type LogInput = z.input<typeof LogInput>;

export interface Entry {
  id: string;
  readOn: string;
  place: "in_person" | "online" | "event";
  name: string;
  question: string | null;
  notes: string | null;
  consent: boolean;
  spread: "one" | "three_any" | "three_pairs";
  cards: LogCards;
  createdAt: Date;
  updatedAt: Date;
}

type Row = { id: string; read_on: string; place: Entry["place"]; name: string; question: string | null; notes: string | null; consent: boolean; spread: Entry["spread"]; cards: LogCards; created_at: string; updated_at: string };
const toEntry = (r: Row): Entry => ({ id: r.id, readOn: String(r.read_on).slice(0, 10), place: r.place, name: r.name, question: r.question, notes: r.notes, consent: r.consent, spread: r.spread, cards: r.cards, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at) });
const COLUMNS = sql`id, to_char(read_on, 'YYYY-MM-DD') as read_on, place, name, question, notes, consent, spread, cards, created_at, updated_at`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every log function starts here: only someone holding the reader role now may touch their log. */
async function mustBeReader(db: Db, readerId: string): Promise<void> {
  if (!(await readerStatus(db, readerId)).reader) throw new HttpError(403, "not_reader");
}

/** Newest first, 30 at a time. The cursor is opaque to the page: date, time and id of the last entry shown. */
export async function listEntries(db: Db, readerId: string, { cursor }: { cursor?: string | null }): Promise<{ items: Entry[]; nextCursor: string | null }> {
  await mustBeReader(db, readerId);
  let after = sql``;
  if (cursor) {
    const [readOn, createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!readOn || !/^\d{4}-\d{2}-\d{2}$/.test(readOn) || !createdAt || Number.isNaN(Date.parse(createdAt)) || !id || !UUID.test(id)) throw new HttpError(400, "invalid_input");
    after = sql`and (read_on, created_at, id) < (${readOn}::date, ${createdAt}::timestamptz, ${id}::uuid)`;
  }
  const rows = await db.execute<Row>(sql`select ${COLUMNS} from reader_log_entry where reader_id = ${readerId} ${after} order by read_on desc, created_at desc, id desc limit ${PageSize + 1}`);
  const items = rows.slice(0, PageSize).map(toEntry);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > PageSize && last ? Buffer.from(`${last.readOn}|${last.createdAt.toISOString()}|${last.id}`).toString("base64url") : null };
}

/** One of the reader's own entries. Someone else's entry is "not found", so ids reveal nothing. */
export async function getEntry(db: Db, readerId: string, id: string): Promise<Entry> {
  await mustBeReader(db, readerId);
  if (!UUID.test(id)) throw new HttpError(404, "not_found");
  const [row] = await db.execute<Row>(sql`select ${COLUMNS} from reader_log_entry where id = ${id}::uuid and reader_id = ${readerId}`);
  if (!row) throw new HttpError(404, "not_found");
  return toEntry(row);
}

/** Creates an entry, or updates one of the reader's own when `id` is given. Returns its id. */
export async function saveEntry(db: Db, readerId: string, input: unknown, id?: string): Promise<string> {
  await mustBeReader(db, readerId);
  const parsed = LogInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "invalid_input");
  const v = parsed.data;
  if (id !== undefined) {
    if (!UUID.test(id)) throw new HttpError(404, "not_found");
    const [row] = await db.execute<{ id: string }>(sql`
      update reader_log_entry set read_on = ${v.readOn}, place = ${v.place}, name = ${v.name}, question = ${v.question}, notes = ${v.notes},
        consent = ${v.consent}, spread = ${v.spread}, cards = ${JSON.stringify(v.cards)}::jsonb, updated_at = now()
      where id = ${id}::uuid and reader_id = ${readerId} returning id`);
    if (!row) throw new HttpError(404, "not_found");
    return row.id;
  }
  const [row] = await db.execute<{ id: string }>(sql`
    insert into reader_log_entry (reader_id, read_on, place, name, question, notes, consent, spread, cards)
    values (${readerId}, ${v.readOn}, ${v.place}, ${v.name}, ${v.question}, ${v.notes}, ${v.consent}, ${v.spread}, ${JSON.stringify(v.cards)}::jsonb) returning id`);
  return row!.id;
}

export async function deleteEntry(db: Db, readerId: string, id: string): Promise<void> {
  await mustBeReader(db, readerId);
  if (!UUID.test(id)) throw new HttpError(404, "not_found");
  const rows = await db.execute<{ id: string }>(sql`delete from reader_log_entry where id = ${id}::uuid and reader_id = ${readerId} returning id`);
  if (rows.length === 0) throw new HttpError(404, "not_found");
}

/**
 * One CSV cell: always quoted, quotes doubled, line breaks kept. A value starting with =, +, -, @, tab or carriage
 * return gets a leading apostrophe so spreadsheets show it as text instead of running it as a formula.
 */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

const PLACE = { in_person: "In person", online: "Online", event: "At an event" } as const;
const SPREAD = { one: "One card", three_any: "Three cards", three_pairs: "Major, then Minor" } as const;
const pick = (c: { id: string; reversed: boolean }) => `${getCard(c.id).name}${c.reversed ? " (reversed)" : ""}`;

/** Every entry of the reader's log as CSV, newest first. */
export async function exportCsv(db: Db, readerId: string): Promise<string> {
  await mustBeReader(db, readerId);
  const rows = (await db.execute<Row>(sql`select ${COLUMNS} from reader_log_entry where reader_id = ${readerId} order by read_on desc, created_at desc`)).map(toEntry);
  const lines = [["Date", "Where", "Name", "Question", "Spread", "Cards", "Accompanying cards", "Notes", "Consent"]];
  for (const e of rows) {
    const cards = e.cards.positions.map((p) => `${p.label}: ${pick(p.card)}${p.clarifier ? ` + ${pick(p.clarifier)}` : ""}`).join("; ");
    const extras = e.cards.extras.map((x) => `${pick(x.card)}${x.attachedTo === null ? "" : ` (with ${e.cards.positions[x.attachedTo]?.label ?? ""})`}`).join("; ");
    lines.push([e.readOn, PLACE[e.place], e.name, e.question ?? "", SPREAD[e.spread], cards, extras, e.notes ?? "", e.consent ? "Yes" : "No"]);
  }
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
