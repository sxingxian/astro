import { getCard } from "@astro/cards";
import { and, desc, eq, isNotNull, lt, or, schema, sql, type AnyDb } from "@astro/db";

export type JournalFilter = "all" | "one" | "three";

export class JournalError extends Error {
  constructor(readonly code: "not_found" | "too_long") {
    super(code);
    this.name = "JournalError";
  }
}

export interface JournalItem {
  id: string;
  localDay: string;
  spread: "one" | "three";
  cardNames: string[];
  hasNote: boolean;
  /** The note, shortened for the list. */
  note: string | null;
  private: boolean;
}

export const NOTE_MAX = 2000;

const encodeCursor = (at: Date, id: string) => Buffer.from(`${at.toISOString()}|${id}`).toString("base64url");
function decodeCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor || cursor.length > 200) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const at = new Date(iso ?? "");
  return Number.isNaN(at.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id) ? null : { at, id };
}

type ListDeck = { order: string[]; orientations: string[]; picks: number[] | null };

/** The query behind `listReadings` (each reading with its first-stage deck, in one round trip), for batching. */
export function listReadingsQuery(db: AnyDb, userId: string, { filter = "all", cursor, limit = 20 }: { filter?: JournalFilter; cursor?: string; limit?: number }) {
  const s = schema.drawSession;
  const after = decodeCursor(cursor);
  return db
    .select({
      id: s.id,
      localDay: s.localDay,
      spread: s.spread,
      private: s.private,
      completedAt: s.completedAt,
      note: schema.readingNote.body,
      deck: sql<ListDeck | null>`(select json_build_object('order', d."order", 'orientations', d.orientations, 'picks', d.picks) from draw_deck d
        where d.session_id = ${s.id} and d.stage in ('single', 'majors') limit 1)`
    })
    .from(s)
    .leftJoin(schema.readingNote, eq(schema.readingNote.sessionId, s.id))
    .where(
      and(
        eq(s.userId, userId),
        eq(s.status, "complete"),
        isNotNull(s.completedAt),
        filter === "all" ? undefined : eq(s.spread, filter),
        after ? or(lt(s.completedAt, after.at), and(eq(s.completedAt, after.at), lt(s.id, after.id))) : undefined
      )
    )
    .orderBy(desc(s.completedAt), desc(s.id))
    .limit(limit + 1);
}

type ListRow = { id: string; localDay: string; spread: "one" | "three"; private: boolean; completedAt: Date | null; note: string | null; deck: ListDeck | null };

export function listReadingsShape(rows: ListRow[], limit = 20): { items: JournalItem[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const items = page.map((r): JournalItem => {
    const deck = r.deck;
    const cardNames = (deck?.picks ?? []).map((p) => `${getCard(deck!.order[p] as string).name}${deck!.orientations[p] === "reversed" ? ", reversed" : ""}`);
    const note = r.note?.trim() ? r.note.trim() : null;
    return { id: r.id, localDay: r.localDay, spread: r.spread, cardNames, hasNote: Boolean(note), note: note && note.length > 80 ? `${note.slice(0, 79)}…` : note, private: r.private };
  });
  const last = page.at(-1);
  return { items, nextCursor: rows.length > limit && last?.completedAt ? encodeCursor(new Date(last.completedAt), last.id) : null };
}

/** Completed readings for the journal, newest first, 20 at a time. One query. */
export async function listReadings(db: AnyDb, userId: string, opts: { filter?: JournalFilter; cursor?: string; limit?: number }): Promise<{ items: JournalItem[]; nextCursor: string | null }> {
  return listReadingsShape(await listReadingsQuery(db, userId, opts), opts.limit ?? 20);
}

async function assertOwner(db: AnyDb, userId: string, sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new JournalError("not_found");
  const [row] = await db.select({ id: schema.drawSession.id }).from(schema.drawSession).where(and(eq(schema.drawSession.id, sessionId), eq(schema.drawSession.userId, userId))).limit(1);
  if (!row) throw new JournalError("not_found");
}

/** Saves the note on a reading; an empty note removes it. */
export async function setNote(db: AnyDb, userId: string, sessionId: string, body: string): Promise<void> {
  await assertOwner(db, userId, sessionId);
  const text = body.trim();
  if (text.length > NOTE_MAX) throw new JournalError("too_long");
  if (!text) {
    await db.delete(schema.readingNote).where(eq(schema.readingNote.sessionId, sessionId));
    return;
  }
  await db
    .insert(schema.readingNote)
    .values({ sessionId, body: text })
    .onConflictDoUpdate({ target: schema.readingNote.sessionId, set: { body: text, updatedAt: sql`now()` } });
}

/** The note on a reading the person owns (null if none or not theirs), for batching with the reading. */
export function noteQuery(db: AnyDb, userId: string, sessionId: string) {
  return db
    .select({ body: schema.readingNote.body })
    .from(schema.readingNote)
    .innerJoin(schema.drawSession, eq(schema.drawSession.id, schema.readingNote.sessionId))
    .where(and(eq(schema.readingNote.sessionId, sessionId), eq(schema.drawSession.userId, userId)))
    .limit(1);
}

export async function getNote(db: AnyDb, userId: string, sessionId: string): Promise<string | null> {
  await assertOwner(db, userId, sessionId);
  const [row] = await db.select({ body: schema.readingNote.body }).from(schema.readingNote).where(eq(schema.readingNote.sessionId, sessionId)).limit(1);
  return row?.body ?? null;
}

/** Private readings stay in the journal but are left out of Patterns. */
export async function setPrivate(db: AnyDb, userId: string, sessionId: string, value: boolean): Promise<void> {
  await assertOwner(db, userId, sessionId);
  await db.update(schema.drawSession).set({ private: value }).where(eq(schema.drawSession.id, sessionId));
}
