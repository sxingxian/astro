import { and, asc, eq, gte, inArray, isNull, lte, schema, type Db, type AnyDb } from "@astro/db";
import type { Orientation } from "@astro/draw";

export type Outcome = "fit" | "partly" | "not" | "skipped";

export class CheckInError extends Error {
  constructor(readonly code: "not_found" | "too_soon" | "already_done" | "too_long") {
    super(code);
    this.name = "CheckInError";
  }
}

export interface DueCheckIn {
  sessionId: string;
  completedAt: Date;
  spread: "one" | "three";
  /** The card the question is about: the single card, or the Present Major for three pairs. */
  cardId: string;
  orientation: Orientation;
  position: "present" | null;
}

const DAY = 86_400_000;
export const NOTE_MAX = 500;

/** Readings 7–30 days old with no check-in yet, oldest first, if the person has check-ins on. */
export async function dueCheckIns(db: AnyDb, userId: string, now: Date = new Date(), limit = 5): Promise<DueCheckIn[]> {
  const s = schema.drawSession;
  const rows = await db
    .select({ id: s.id, completedAt: s.completedAt, spread: s.spread })
    .from(s)
    .innerJoin(schema.user, eq(schema.user.id, s.userId))
    .leftJoin(schema.checkIn, eq(schema.checkIn.sessionId, s.id))
    .where(
      and(
        eq(s.userId, userId),
        eq(s.status, "complete"),
        eq(schema.user.checkInsEnabled, true),
        isNull(schema.checkIn.sessionId),
        lte(s.completedAt, new Date(now.getTime() - 7 * DAY)),
        gte(s.completedAt, new Date(now.getTime() - 30 * DAY))
      )
    )
    .orderBy(asc(s.completedAt))
    .limit(limit);
  if (!rows.length) return [];
  const decks = await db.select().from(schema.drawDeck).where(inArray(schema.drawDeck.sessionId, rows.map((r) => r.id)));
  return rows.flatMap((r) => {
    const deck = decks.find((d) => d.sessionId === r.id && (r.spread === "one" ? d.stage === "single" : d.stage === "majors"));
    const pos = r.spread === "one" ? deck?.picks[0] : deck?.picks[1];
    if (!deck || pos === undefined || !r.completedAt) return [];
    return [{ sessionId: r.id, completedAt: r.completedAt, spread: r.spread, cardId: deck.order[pos] as string, orientation: deck.orientations[pos] as Orientation, position: r.spread === "three" ? ("present" as const) : null }];
  });
}

/** Records how a reading turned out. Once per reading; never before it is 7 days old. */
export async function saveCheckIn(db: Db, userId: string, sessionId: string, { outcome, note }: { outcome: Outcome; note?: string }, now: Date = new Date()): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new CheckInError("not_found");
  const text = note?.trim() || null;
  if (text && text.length > NOTE_MAX) throw new CheckInError("too_long");
  const [s] = await db
    .select({ completedAt: schema.drawSession.completedAt, status: schema.drawSession.status })
    .from(schema.drawSession)
    .where(and(eq(schema.drawSession.id, sessionId), eq(schema.drawSession.userId, userId)))
    .limit(1);
  if (!s || s.status !== "complete" || !s.completedAt) throw new CheckInError("not_found");
  if (now.getTime() - s.completedAt.getTime() < 7 * DAY) throw new CheckInError("too_soon");
  const inserted = await db.insert(schema.checkIn).values({ sessionId, outcome, note: outcome === "skipped" ? null : text }).onConflictDoNothing().returning({ id: schema.checkIn.sessionId });
  if (!inserted.length) throw new CheckInError("already_done");
}

/** One due check-in for the check-in page, or null if it isn't due for this person. */
export async function findDue(db: Db, userId: string, sessionId: string, now: Date = new Date()): Promise<DueCheckIn | null> {
  return (await dueCheckIns(db, userId, now, 50)).find((d) => d.sessionId === sessionId) ?? null;
}
