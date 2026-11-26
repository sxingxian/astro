import { sql, type Db } from "@astro/db";

export type DashboardRange = "today" | "7d";

export interface DashboardCounts {
  readings: number;
  readingsOne: number;
  readingsThree: number;
  signUps: number;
  signUpsTwoStep: number;
  /** Signed-in people who started a reading in the range. */
  activePeople: number;
  /** Check-ins with an answer (skipped ones don't count). Notes are never read. */
  checkInsAnswered: number;
}

/** Today is the current UTC day; 7 days is the last 7 UTC days including today. One aggregate query. */
export async function getDashboard(db: Db, range: DashboardRange, now = new Date()): Promise<DashboardCounts> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(today.getTime() - (range === "7d" ? 6 : 0) * 86_400_000).toISOString();
  const [r] = await db.execute<Record<keyof DashboardCounts, number>>(sql`
    select
      (select count(*)::int from draw_session where status = 'complete' and completed_at >= ${since}::timestamptz) as "readings",
      (select count(*)::int from draw_session where status = 'complete' and spread = 'one' and completed_at >= ${since}::timestamptz) as "readingsOne",
      (select count(*)::int from draw_session where status = 'complete' and spread = 'three' and completed_at >= ${since}::timestamptz) as "readingsThree",
      (select count(*)::int from "user" where created_at >= ${since}::timestamptz) as "signUps",
      (select count(*)::int from "user" where created_at >= ${since}::timestamptz and two_factor_enabled) as "signUpsTwoStep",
      (select count(distinct user_id)::int from draw_session where user_id is not null and created_at >= ${since}::timestamptz) as "activePeople",
      (select count(*)::int from check_in where outcome <> 'skipped' and created_at >= ${since}::timestamptz) as "checkInsAnswered"`);
  return r as DashboardCounts;
}
