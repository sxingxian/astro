import { getCard } from "@astro/cards";
import { and, desc, eq, inArray, isNotNull, lt, or, schema, sql, type AnyDb } from "@astro/db";

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

/** Completed readings for the journal, newest first, 20 at a time. */
export async function listReadings(db: AnyDb, userId: string, { filter = "all", cursor, limit = 20 }: { filter?: JournalFilter; cursor?: string; limit?: number }): Promise<{ items: JournalItem[]; nextCursor: string | null }> {
  const s = schema.drawSession;
  const after = decodeCursor(cursor);
  const rows = await db
    .select({ id: s.id, localDay: s.localDay, spread: s.spread, private: s.private, completedAt: s.completedAt, note: schema.readingNote.body })
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

  const page = rows.slice(0, limit);
  const decks = page.length
    ? await db.select({ sessionId: schema.drawDeck.sessionId, stage: schema.drawDeck.stage, order: schema.drawDeck.order, orientations: schema.drawDeck.orientations, picks: schema.drawDeck.picks }).from(schema.drawDeck).where(inArray(schema.drawDeck.sessionId, page.map((r) => r.id)))
    : [];

  const items = page.map((r): JournalItem => {
    const deck = decks.find((d) => d.sessionId === r.id && (d.stage === "single" || d.stage === "majors"));
    const cardNames = (deck?.picks ?? []).map((p) => `${getCard(deck!.order[p] as string).name}${deck!.orientations[p] === "reversed" ? ", reversed" : ""}`);
    const note = r.note?.trim() ? r.note.trim() : null;
    return { id: r.id, localDay: r.localDay, spread: r.spread, cardNames, hasNote: Boolean(note), note: note && note.length > 80 ? `${note.slice(0, 79)}…` : note, private: r.private };
  });
  const last = page.at(-1);
  return { items, nextCursor: rows.length > limit && last?.completedAt ? encodeCursor(last.completedAt, last.id) : null };
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
