import { majors, minors, allCards } from "@astro/cards";
import { and, desc, eq, schema, sql, type Db } from "@astro/db";
import { createDeck, isTimeZone, localDay, nextLocalMidnight, type Orientation } from "@astro/draw";
import { getSetting } from "@astro/server";
import { DrawError } from "./errors";

export type Actor = { kind: "user"; userId: string; timeZone: string } | { kind: "guest"; guestHash: string; ipHash: string; timeZone: string };
export type Spread = "one" | "three";
export type Stage = "single" | "majors" | "minors";

export interface DrawnCard {
  position: number;
  cardId: string;
  orientation: Orientation;
}

export interface DeckView {
  stage: Stage;
  size: number;
  fingerprint: string;
  picks: number[];
  cards: DrawnCard[];
}

export interface StartResult {
  sessionId: string;
  spread: Spread;
  status: "picking" | "complete";
  timeZone: string;
  decks: DeckView[];
}

export interface Reading extends StartResult {
  localDay: string;
  private: boolean;
  createdAt: string;
  completedAt: string | null;
  /** Present only once the reading is complete. */
  reveal?: { stage: Stage; order: string[]; orientations: Orientation[]; salt: string }[];
}

const GUEST_TTL_MS = 48 * 3600_000;

const STAGES: Record<Spread, { stage: Stage; cards: readonly string[]; count: number }[]> = {
  one: [{ stage: "single", cards: allCards.map((c) => c.id), count: 1 }],
  three: [
    { stage: "majors", cards: majors.map((c) => c.id), count: 3 },
    { stage: "minors", cards: minors.map((c) => c.id), count: 3 }
  ]
};

type SessionRow = typeof schema.drawSession.$inferSelect;
/** The database or a transaction on it. */
type Exec = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;
type DeckRow = typeof schema.drawDeck.$inferSelect;

const zoneOf = (actor: Actor) => (isTimeZone(actor.timeZone) ? actor.timeZone : "UTC");

const ownerFilter = (actor: Actor) =>
  actor.kind === "user" ? eq(schema.drawSession.userId, actor.userId) : eq(schema.drawSession.guestHash, actor.guestHash);

function deckView(d: DeckRow): DeckView {
  const picks = d.picks ?? [];
  return {
    stage: d.stage,
    size: d.order.length,
    fingerprint: d.fingerprint,
    picks,
    cards: picks.map((p) => ({ position: p, cardId: d.order[p] as string, orientation: d.orientations[p] as Orientation }))
  };
}

const stageRank = (s: Stage) => ({ single: 0, majors: 0, minors: 1 })[s];

async function decksFor(db: Exec, sessionId: string): Promise<DeckRow[]> {
  const rows = await db.select().from(schema.drawDeck).where(eq(schema.drawDeck.sessionId, sessionId));
  return rows.sort((a, b) => stageRank(a.stage) - stageRank(b.stage));
}

function startResult(s: SessionRow, decks: DeckRow[]): StartResult {
  return { sessionId: s.id, spread: s.spread, status: s.status, timeZone: s.timeZone, decks: decks.map(deckView) };
}

/** The person's reading for this spread that still counts as "today" in the reading's own timezone, if any. */
async function todays(db: Exec, actor: Actor, spread: Spread, now: Date): Promise<SessionRow | null> {
  const where = actor.kind === "user" ? and(ownerFilter(actor), eq(schema.drawSession.spread, spread)) : ownerFilter(actor);
  const [latest] = await db.select().from(schema.drawSession).where(where).orderBy(desc(schema.drawSession.createdAt)).limit(1);
  if (!latest) return null;
  return localDay(now, latest.timeZone) === latest.localDay ? latest : null;
}

async function purgeOldGuestReadings(db: Exec, now: Date) {
  const cutoff = new Date(now.getTime() - GUEST_TTL_MS);
  await db.execute(sql`
    delete from draw_session where id in (
      select id from draw_session where guest_hash is not null and created_at < ${cutoff.toISOString()}::timestamptz limit 200
    )`);
}

/** Counts a new guest reading against the network's daily cap (UTC day: a guest's timezone is not trusted). */
async function takeGuestSlot(db: Exec, ipHash: string, now: Date) {
  const day = now.toISOString().slice(0, 10);
  const [row] = await db
    .insert(schema.guestDayCap)
    .values({ ipHash, localDay: day, count: 1 })
    .onConflictDoUpdate({ target: [schema.guestDayCap.ipHash, schema.guestDayCap.localDay], set: { count: sql`${schema.guestDayCap.count} + 1` } })
    .returning({ count: schema.guestDayCap.count });
  if ((row?.count ?? 0) > (await getSetting(db, "guest_daily_cap"))) throw new DrawError("rate_limited");
}

/** Today's reading for this spread if one exists, without creating anything. */
export async function findToday(db: Db, actor: Actor, spread: Spread, now: Date = new Date()): Promise<StartResult | null> {
  const s = await todays(db, actor, spread, now);
  return s ? startResult(s, await decksFor(db, s.id)) : null;
}

/**
 * Starts today's reading, or returns the one already in progress. A completed reading for today
 * raises `daily_limit` with the time the person can draw again.
 *
 * The check and the insert run under a per-person advisory lock, so parallel requests (two tabs, or
 * a guest sending several timezones at once) can never create two readings for one day.
 */
export async function startDraw(db: Db, actor: Actor, spread: Spread, now: Date = new Date()): Promise<StartResult> {
  if (actor.kind === "guest" && spread !== "one") throw new DrawError("guest_spread");

  const timeZone = zoneOf(actor);
  const day = localDay(now, timeZone);
  const lockKey = actor.kind === "user" ? `draw:u:${actor.userId}:${spread}` : `draw:g:${actor.guestHash}`;
  // Shuffle outside the lock; it's cheap and keeps the critical section short.
  const rate = await getSetting(db, "reversal_rate");
  const decks = await Promise.all(STAGES[spread].map(async (s) => ({ stage: s.stage, deck: await createDeck(s.cards, rate) })));

  const finish = async (tx: Exec, session: SessionRow): Promise<StartResult> => {
    if (session.status === "complete") throw new DrawError("daily_limit", { sessionId: session.id, resetsAt: nextLocalMidnight(now, session.timeZone).toISOString() });
    return startResult(session, await decksFor(tx, session.id));
  };

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    const existing = await todays(tx, actor, spread, now);
    if (existing) return finish(tx, existing);

    if (actor.kind === "guest") {
      await purgeOldGuestReadings(tx, now);
      await takeGuestSlot(tx, actor.ipHash, now);
    }

    const [row] = await tx
      .insert(schema.drawSession)
      .values({
        userId: actor.kind === "user" ? actor.userId : null,
        guestHash: actor.kind === "guest" ? actor.guestHash : null,
        spread,
        localDay: day,
        timeZone,
        status: "picking",
        createdAt: now
      })
      .onConflictDoNothing()
      .returning();

    if (row) {
      await tx.insert(schema.drawDeck).values(decks.map(({ stage, deck }) => ({ sessionId: row.id, stage, ...deck })));
      return startResult(row, await decksFor(tx, row.id));
    }

    // A reading already holds this calendar day in the person's current timezone (for example, after a
    // move west). That reading is today's: continue it, or report the daily limit if it's finished.
    const where = actor.kind === "user" ? and(ownerFilter(actor), eq(schema.drawSession.spread, spread), eq(schema.drawSession.localDay, day)) : and(ownerFilter(actor), eq(schema.drawSession.localDay, day));
    const [held] = await tx.select().from(schema.drawSession).where(where).limit(1);
    if (!held) throw new DrawError("not_found");
    return finish(tx, held);
  });
}

async function owned(db: Db, actor: Actor, sessionId: string): Promise<SessionRow> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new DrawError("not_found");
  const [s] = await db.select().from(schema.drawSession).where(and(eq(schema.drawSession.id, sessionId), ownerFilter(actor))).limit(1);
  if (!s) throw new DrawError("not_found");
  return s;
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Reveals the cards at the chosen positions. Repeating the same pick returns the same cards. */
export async function pick(db: Db, actor: Actor, sessionId: string, stage: Stage, positions: number[], now: Date = new Date()): Promise<{ cards: DrawnCard[]; status: "picking" | "complete" }> {
  const session = await owned(db, actor, sessionId);
  const plan = STAGES[session.spread];
  const stageIndex = plan.findIndex((p) => p.stage === stage);
  if (stageIndex < 0) throw new DrawError("wrong_stage");
  const spec = plan[stageIndex]!;

  const decks = await decksFor(db, session.id);
  const deck = decks.find((d) => d.stage === stage);
  if (!deck) throw new DrawError("not_found");
  const previous = stageIndex > 0 ? decks.find((d) => d.stage === plan[stageIndex - 1]!.stage) : undefined;
  if (previous && (previous.picks ?? []).length === 0) throw new DrawError("wrong_stage");

  const valid =
    positions.length === spec.count &&
    positions.every((p) => Number.isInteger(p) && p >= 0 && p < deck.order.length) &&
    new Set(positions).size === positions.length;
  if (!valid) throw new DrawError("bad_positions");

  let current = deck;
  if ((deck.picks ?? []).length === 0) {
    const [updated] = await db
      .update(schema.drawDeck)
      .set({ picks: positions })
      .where(and(eq(schema.drawDeck.sessionId, session.id), eq(schema.drawDeck.stage, stage), sql`cardinality(${schema.drawDeck.picks}) = 0`))
      .returning();
    current = updated ?? (await decksFor(db, session.id)).find((d) => d.stage === stage) ?? deck;
  }
  if (!sameList(current.picks ?? [], positions)) throw new DrawError("stage_done");

  let status = session.status;
  const isLast = stageIndex === plan.length - 1;
  if (isLast && status === "picking") {
    await db
      .update(schema.drawSession)
      .set({ status: "complete", completedAt: now })
      .where(and(eq(schema.drawSession.id, session.id), eq(schema.drawSession.status, "picking")));
    status = "complete";
  }
  return { cards: deckView(current).cards, status };
}

/** A reading as its owner may see it. Orders, orientations and salts appear only once it is complete. */
export async function getReading(db: Db, actor: Actor, sessionId: string, _now: Date = new Date()): Promise<Reading> {
  const s = await owned(db, actor, sessionId);
  const decks = await decksFor(db, s.id);
  const base: Reading = {
    ...startResult(s, decks),
    localDay: s.localDay,
    private: s.private,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null
  };
  if (s.status !== "complete") return base;
  return { ...base, reveal: decks.map((d) => ({ stage: d.stage, order: d.order, orientations: d.orientations as Orientation[], salt: d.salt })) };
}

