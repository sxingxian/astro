import { majors, minors, allCards } from "@astro/cards";
import { and, desc, eq, getTableColumns, rowsOf, runInOrder, schema, sql, type AnyDb } from "@astro/db";
import { createDeck, isTimeZone, localDay, nextLocalMidnight, type Orientation } from "@astro/draw";
import { getSetting, getSettings } from "@astro/server";
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
type Exec = Pick<AnyDb, "select" | "insert" | "update" | "delete" | "execute">;
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

async function decksFor(db: Pick<AnyDb, "select">, sessionId: string): Promise<DeckRow[]> {
  const rows = await db.select().from(schema.drawDeck).where(eq(schema.drawDeck.sessionId, sessionId));
  return rows.sort((a, b) => stageRank(a.stage) - stageRank(b.stage));
}

/** The session's decks inside the same query (one round trip), as JSON rows. */
type DeckJson = { session_id: string; stage: Stage; order: string[]; orientations: string[]; salt: string; fingerprint: string; picks: number[] | null };
const decksJson = sql<DeckJson[]>`coalesce((select json_agg(d) from draw_deck d where d.session_id = ${schema.drawSession.id}), '[]'::json)`;
const toDecks = (rows: DeckJson[]): DeckRow[] =>
  rows
    .map((d) => ({ sessionId: d.session_id, stage: d.stage, order: d.order, orientations: d.orientations, salt: d.salt, fingerprint: d.fingerprint, picks: d.picks ?? [] }))
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage));
const withDecks = { ...getTableColumns(schema.drawSession), decks: decksJson };

function startResult(s: SessionRow, decks: DeckRow[]): StartResult {
  return { sessionId: s.id, spread: s.spread, status: s.status, timeZone: s.timeZone, decks: decks.map(deckView) };
}

/** The person's reading for this spread that still counts as "today" in the reading's own timezone, if any. */
async function todays(db: Pick<AnyDb, "select">, actor: Actor, spread: Spread, now: Date): Promise<SessionRow | null> {
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

/** The query behind `findToday` (the latest reading for this spread, with its decks), for batching. */
export function findTodayQuery(db: AnyDb, actor: Actor, spread: Spread) {
  const where = actor.kind === "user" ? and(ownerFilter(actor), eq(schema.drawSession.spread, spread)) : ownerFilter(actor);
  return db.select(withDecks).from(schema.drawSession).where(where).orderBy(desc(schema.drawSession.createdAt)).limit(1);
}

/** Today's reading from `findTodayQuery`'s rows: the latest one, if it still counts as today in its own timezone. */
export function findTodayShape(rows: (SessionRow & { decks: DeckJson[] })[], now: Date = new Date()): StartResult | null {
  const latest = rows[0];
  if (!latest || localDay(now, latest.timeZone) !== latest.localDay) return null;
  return startResult(latest, toDecks(latest.decks));
}

/** Today's reading for this spread if one exists, without creating anything. One query. */
export async function findToday(db: AnyDb, actor: Actor, spread: Spread, now: Date = new Date()): Promise<StartResult | null> {
  return findTodayShape(await findTodayQuery(db, actor, spread), now);
}

/**
 * Starts today's reading, or returns the one already in progress. A completed reading for today
 * raises `daily_limit` with the time the person can draw again.
 *
 * The check and the insert run under a per-person advisory lock, so parallel requests (two tabs, or
 * a guest sending several timezones at once) can never create two readings for one day.
 */
/** The Postgres error code behind a driver or Drizzle error (Drizzle keeps the driver's error in `cause`). */
function pgCode(e: unknown): string | undefined {
  const own = (e as { code?: unknown } | null)?.code;
  const cause = (e as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof own === "string" ? own : typeof cause === "string" ? cause : undefined;
}

/** A draw_session row as `to_jsonb` returns it. */
type SessionJson = { id: string; user_id: string | null; guest_hash: string | null; spread: Spread; local_day: string; time_zone: string; status: "picking" | "complete"; private: boolean; created_at: string; completed_at: string | null };
const sessionOf = (j: SessionJson): SessionRow => ({
  id: j.id,
  userId: j.user_id,
  guestHash: j.guest_hash,
  spread: j.spread,
  localDay: j.local_day,
  timeZone: j.time_zone,
  status: j.status,
  private: j.private,
  createdAt: new Date(j.created_at),
  completedAt: j.completed_at ? new Date(j.completed_at) : null
});

/**
 * Starts today's reading, or returns it if it exists (`daily_limit` once it's complete). One database call (the
 * `start_draw` function: lock, today's reading, guest cap, inserts), so it works over Neon's HTTPS driver. Until that
 * function exists (a deploy that ran before its migration) it falls back to an interactive transaction on `txDb`.
 */
export async function startDraw(db: AnyDb, actor: Actor, spread: Spread, now: Date = new Date(), txDb: () => AnyDb = () => db): Promise<StartResult> {
  if (actor.kind === "guest" && spread !== "one") throw new DrawError("guest_spread");

  const timeZone = zoneOf(actor);
  const day = localDay(now, timeZone);
  const { reversal_rate: rate, guest_daily_cap: cap } = await getSettings(db, ["reversal_rate", "guest_daily_cap"] as const);
  const decks = await Promise.all(STAGES[spread].map(async (s) => ({ stage: s.stage, deck: await createDeck(s.cards, rate) })));
  const finish = (session: SessionRow, rows: DeckRow[]): StartResult => {
    if (session.status === "complete") throw new DrawError("daily_limit", { sessionId: session.id, resetsAt: nextLocalMidnight(now, session.timeZone).toISOString() });
    return startResult(session, rows);
  };

  try {
    const user = actor.kind === "user" ? actor.userId : null;
    const guest = actor.kind === "guest" ? actor.guestHash : null;
    const ip = actor.kind === "guest" ? actor.ipHash : null;
    const cutoff = new Date(now.getTime() - GUEST_TTL_MS).toISOString();
    const deckJson = JSON.stringify(decks.map(({ stage, deck }) => ({ stage, ...deck })));
    const [row] = rowsOf<{ r: unknown }>(
      await db.execute(
        sql`select start_draw(${user}, ${guest}, ${ip}, ${spread}, ${day}::date, ${timeZone}, ${now.toISOString()}::timestamptz, ${now.toISOString().slice(0, 10)}::date, ${cutoff}::timestamptz, ${cap}::int, ${deckJson}::text::jsonb) as r`
      )
    );
    const r = (typeof row?.r === "string" ? JSON.parse(row.r) : row?.r) as { session: SessionJson; decks: DeckJson[] };
    return finish(sessionOf(r.session), toDecks(r.decks));
  } catch (e) {
    if (e instanceof DrawError) throw e;
    const code = pgCode(e);
    if (code === "AS429") throw new DrawError("rate_limited");
    if (code === "AS404") throw new DrawError("not_found");
    if (code !== "42883") throw e; // anything but "the function doesn't exist yet"
  }
  return startDrawInTransaction(txDb(), actor, spread, now, day, timeZone, decks, finish);
}

/** The steps of `start_draw`, as an interactive transaction (only until the migration that adds it has run). */
async function startDrawInTransaction(
  db: AnyDb,
  actor: Actor,
  spread: Spread,
  now: Date,
  day: string,
  timeZone: string,
  decks: { stage: Stage; deck: Awaited<ReturnType<typeof createDeck>> }[],
  finish: (session: SessionRow, rows: DeckRow[]) => StartResult
): Promise<StartResult> {
  const lockKey = actor.kind === "user" ? `draw:u:${actor.userId}:${spread}` : `draw:g:${actor.guestHash}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    const existing = await todays(tx, actor, spread, now);
    if (existing) return finish(existing, await decksFor(tx, existing.id));

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
    return finish(held, await decksFor(tx, held.id));
  });
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Reveals the cards at the chosen positions. Repeating the same pick returns the same cards. Two database requests. */
export async function pick(db: AnyDb, actor: Actor, sessionId: string, stage: Stage, positions: number[], now: Date = new Date()): Promise<{ cards: DrawnCard[]; status: "picking" | "complete" }> {
  // The reading and its decks in one query.
  const [session] = await getReadingQuery(db, actor, sessionId);
  if (!session) throw new DrawError("not_found");
  const plan = STAGES[session.spread];
  const stageIndex = plan.findIndex((p) => p.stage === stage);
  if (stageIndex < 0) throw new DrawError("wrong_stage");
  const spec = plan[stageIndex]!;

  const decks = toDecks(session.decks);
  const deck = decks.find((d) => d.stage === stage);
  if (!deck) throw new DrawError("not_found");
  const previous = stageIndex > 0 ? decks.find((d) => d.stage === plan[stageIndex - 1]!.stage) : undefined;
  if (previous && (previous.picks ?? []).length === 0) throw new DrawError("wrong_stage");

  const valid =
    positions.length === spec.count &&
    positions.every((p) => Number.isInteger(p) && p >= 0 && p < deck.order.length) &&
    new Set(positions).size === positions.length;
  if (!valid) throw new DrawError("bad_positions");

  const isLast = stageIndex === plan.length - 1;
  // Completes the reading only if these picks are the ones stored for its last stage.
  const complete = () =>
    db
      .update(schema.drawSession)
      .set({ status: "complete", completedAt: now })
      .where(
        and(
          eq(schema.drawSession.id, session.id),
          eq(schema.drawSession.status, "picking"),
          sql`exists (select 1 from draw_deck where session_id = ${session.id} and stage = ${stage} and picks = ${`{${positions.join(",")}}`}::integer[])`
        )
      )
      .returning({ id: schema.drawSession.id });

  let current = deck;
  let status = session.status;
  if ((deck.picks ?? []).length === 0) {
    const save = db
      .update(schema.drawDeck)
      .set({ picks: positions })
      .where(and(eq(schema.drawDeck.sessionId, session.id), eq(schema.drawDeck.stage, stage), sql`cardinality(${schema.drawDeck.picks}) = 0`))
      .returning();
    // Saving the picks and completing the reading: one request, in order.
    const [saved, completed] = isLast && status === "picking" ? await runInOrder(db, [save, complete()] as const) : [await save, []];
    if (completed.length) status = "complete";
    current = saved[0] ?? (await decksFor(db, session.id)).find((d) => d.stage === stage) ?? deck;
  }
  if (!sameList(current.picks ?? [], positions)) throw new DrawError("stage_done");
  // Someone else saved the same picks first: make sure the reading is complete.
  if (isLast && status === "picking") {
    await complete();
    status = "complete";
  }
  return { cards: deckView(current).cards, status };
}

/** A reading as its owner may see it. Orders, orientations and salts appear only once it is complete. */
/** The query behind `getReading` (the session, if it is the actor's, with its decks), for batching. */
export function getReadingQuery(db: AnyDb, actor: Actor, sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new DrawError("not_found");
  return db.select(withDecks).from(schema.drawSession).where(and(eq(schema.drawSession.id, sessionId), ownerFilter(actor))).limit(1);
}

/** The reading from `getReadingQuery`'s rows; `not_found` if it isn't there (or isn't theirs). */
export function getReadingShape(rows: (SessionRow & { decks: DeckJson[] })[]): Reading {
  const s = rows[0];
  if (!s) throw new DrawError("not_found");
  const decks = toDecks(s.decks);
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

/** A reading the actor owns, with everything the reading page shows. One query. */
export async function getReading(db: AnyDb, actor: Actor, sessionId: string, _now: Date = new Date()): Promise<Reading> {
  return getReadingShape(await getReadingQuery(db, actor, sessionId));
}

