import { and, eq, isNull, lt, or, schema, type AnyDb } from "@astro/db";
import { isTimeZone } from "@astro/draw";

const WEEK = 7 * 86_400_000;

export { takePasswordAttempt } from "@astro/server";

export type TimeZoneResult = { ok: true } | { ok: false; nextChange: string };

/**
 * Changes the timezone at most once every 7 days. The update is conditional, so concurrent requests
 * can't each succeed.
 */
export async function setTimeZone(db: AnyDb, userId: string, timeZone: string, now: Date = new Date()): Promise<TimeZoneResult> {
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

export { MAX_PASSWORD_ATTEMPTS } from "@astro/server";

