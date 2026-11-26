import { schema, sql, type Db } from "@astro/db";

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
