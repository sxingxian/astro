import { and, eq, isNull, lt, or, schema, sql, type Db } from "@astro/db";
import { isTimeZone } from "@astro/draw";

const WEEK = 7 * 86_400_000;

export type TimeZoneResult = { ok: true } | { ok: false; nextChange: string };

/**
 * Changes the timezone at most once every 7 days. The update is conditional, so concurrent requests
 * can't each succeed.
 */
export async function setTimeZone(db: Db, userId: string, timeZone: string, now: Date = new Date()): Promise<TimeZoneResult> {
  if (!isTimeZone(timeZone)) throw new RangeError("not a timezone");
  const cutoff = new Date(now.getTime() - WEEK);
  const updated = await db
    .update(schema.user)
    .set({ timeZone, timeZoneChangedAt: now })
    .where(and(eq(schema.user.id, userId), or(isNull(schema.user.timeZoneChangedAt), lt(schema.user.timeZoneChangedAt, cutoff))))
    .returning({ id: schema.user.id });
  if (updated.length) return { ok: true };
  const [row] = await db.select({ tz: schema.user.timeZone, at: schema.user.timeZoneChangedAt }).from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (row?.tz === timeZone) return { ok: true };
  return { ok: false, nextChange: new Date((row?.at ?? now).getTime() + WEEK).toISOString() };
}

const ATTEMPT_WINDOW = 15 * 60_000;
export const MAX_PASSWORD_ATTEMPTS = 5;

/**
 * Counts one password check for a signed-in person (delete account, 2-step on/off, password change).
 * Better Auth's own limits don't cover server-side calls, so a stolen session can't be used to guess the password.
 */
export async function takePasswordAttempt(db: Db, userId: string, now: Date = new Date()): Promise<boolean> {
  const key = `astro-pw:${userId}`;
  const nowMs = now.getTime();
  const windowStart = nowMs - ATTEMPT_WINDOW;
  const [row] = await db
    .insert(schema.rateLimit)
    .values({ id: key, key, count: 1, lastRequest: nowMs })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then 1 else ${schema.rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then ${nowMs} else ${schema.rateLimit.lastRequest} end`
      }
    })
    .returning({ count: schema.rateLimit.count });
  return (row?.count ?? 0) <= MAX_PASSWORD_ATTEMPTS;
}
