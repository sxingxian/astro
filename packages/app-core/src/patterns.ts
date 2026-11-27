import { rowsOf, sql, type AnyDb } from "@astro/db";
import type { Suit } from "@astro/cards";

export type PatternRange = "30d" | "90d" | "all";

export interface Patterns {
  readings: number;
  cards: number;
  repeats: { cardId: string; count: number }[];
  elements: { suit: Suit; count: number }[];
  /** Percentage of drawn cards that were Majors, rounded to a whole number. */
  majorShare: number;
  reversed: { count: number; of: number };
  outcomes: { fit: number; partly: number; not: number };
  checkedIn: { done: number; eligible: number };
}

const SUITS: Suit[] = ["wands", "cups", "swords", "pentacles"];
const DAY = 86_400_000;

type Row = {
  readings: number;
  cards: number;
  majors: number;
  reversed: number;
  repeats: { cardId: string; count: number }[];
  suits: Record<string, number>;
  outcomes: { fit: number; partly: number; not: number };
  done: number;
  eligible: number;
};

/** Patterns over a person's completed, non-private readings. All counting happens in SQL. */
export async function computePatterns(db: AnyDb, userId: string, range: PatternRange, now: Date = new Date()): Promise<Patterns> {
  const since = range === "all" ? null : new Date(now.getTime() - (range === "30d" ? 30 : 90) * DAY).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const rows = rowsOf<Row>(await db.execute(sql`
    with s as (
      select id, completed_at from draw_session
      where user_id = ${userId} and status = 'complete' and not private
        and (${since}::timestamptz is null or completed_at >= ${since}::timestamptz)
    ), c as (
      select d."order"[p + 1] as card_id, d.orientations[p + 1] as orientation, s.completed_at
      from s join draw_deck d on d.session_id = s.id cross join lateral unnest(d.picks) as p
    )
    select
      (select count(*) from s)::int as readings,
      (select count(*) from c)::int as cards,
      (select count(*) from c where split_part(card_id, '-of-', 2) not in ('wands', 'cups', 'swords', 'pentacles'))::int as majors,
      (select count(*) from c where orientation = 'reversed')::int as reversed,
      coalesce((select json_agg(r) from (
        select card_id as "cardId", count(*)::int as count from c group by card_id having count(*) >= 2
        order by count(*) desc, max(completed_at) desc limit 3) r), '[]'::json) as repeats,
      coalesce((select json_object_agg(suit, n) from (
        select split_part(card_id, '-of-', 2) as suit, count(*)::int as n from c where split_part(card_id, '-of-', 2) in ('wands', 'cups', 'swords', 'pentacles') group by 1) e), '{}'::json) as suits,
      (select json_build_object(
        'fit', count(*) filter (where ci.outcome = 'fit'),
        'partly', count(*) filter (where ci.outcome = 'partly'),
        'not', count(*) filter (where ci.outcome = 'not'))
        from check_in ci join s on s.id = ci.session_id) as outcomes,
      (select count(*) from check_in ci join s on s.id = ci.session_id where ci.outcome <> 'skipped')::int as done,
      (select count(*) from s where completed_at <= ${weekAgo}::timestamptz)::int as eligible
  `));
  const r = rows[0] as Row;
  const elements = SUITS.map((suit) => ({ suit, count: Number(r.suits[suit] ?? 0) })).sort((a, b) => b.count - a.count || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
  return {
    readings: r.readings,
    cards: r.cards,
    repeats: r.repeats.map((x) => ({ cardId: x.cardId, count: Number(x.count) })),
    elements,
    majorShare: r.cards ? Math.round((100 * r.majors) / r.cards) : 0,
    reversed: { count: r.reversed, of: r.cards },
    outcomes: { fit: Number(r.outcomes.fit), partly: Number(r.outcomes.partly), not: Number(r.outcomes.not) },
    checkedIn: { done: r.done, eligible: r.eligible }
  };
}
