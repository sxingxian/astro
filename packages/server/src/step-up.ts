import { eq, schema, sql, type Db } from "@astro/db";
import { decryptTwoFactorKey, verifyTotp } from "./totp";

export type StepUpReason = "no_authenticator" | "wrong_code" | "replayed" | "too_many";

export class StepUpFailed extends Error {
  constructor(readonly reason: StepUpReason) {
    super(reason);
  }
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

interface StepUpInput {
  userId: string;
  code: string;
  authSecret: string;
  now: Date;
}

/**
 * Requires a fresh authenticator code before a sensitive action. Every attempt is counted atomically before the
 * code is checked, so parallel guesses can't get past the limit: more than five attempts in 15 minutes lock the
 * check until the window passes; a correct code clears the count. Each code works once (its time step is recorded
 * atomically), and the code used to sign in is burned at sign-in (burnSignInStep).
 */
export async function requireStepUp(db: Db, { userId, code, authSecret, now }: StepUpInput): Promise<void> {
  const failKey = `astro-stepup:${userId}`;
  const stepKey = `astro-totp-step:${userId}`;
  const nowMs = now.getTime();
  const windowStart = nowMs - WINDOW_MS;

  // The window starts at the first attempt; an attempt after the window starts a new one.
  const [attempt] = await db.execute<{ count: number }>(sql`
    insert into rate_limit (id, key, count, last_request) values (${crypto.randomUUID()}, ${failKey}, 1, ${nowMs})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${windowStart} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${windowStart} then ${nowMs} else rate_limit.last_request end
    returning count`);
  if (Number(attempt?.count ?? 0) > MAX_FAILURES) throw new StepUpFailed("too_many");

  const [tf] = await db.select({ secret: schema.twoFactor.secret }).from(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
  if (!tf) throw new StepUpFailed("no_authenticator");

  const step = await verifyTotp(await decryptTwoFactorKey(tf.secret, authSecret), code, now);
  if (step === null) throw new StepUpFailed("wrong_code");

  // Record the step only if it's newer than the last one used: a second use of the same code updates nothing.
  const used = await db.execute(sql`
    insert into rate_limit (id, key, count, last_request) values (${crypto.randomUUID()}, ${stepKey}, ${step}, ${nowMs})
    on conflict (key) do update set count = excluded.count, last_request = excluded.last_request
    where rate_limit.count < excluded.count
    returning key`);
  if (used.length === 0) throw new StepUpFailed("replayed");

  await db.delete(schema.rateLimit).where(eq(schema.rateLimit.key, failKey));
}

/**
 * After a sign-in with an authenticator code: marks every code valid at that moment as used, so a phished sign-in
 * code can't also approve a sensitive action. Codes are accepted one step either side, hence current step + 1.
 */
export async function burnSignInStep(db: Db, userId: string, now: Date): Promise<void> {
  const step = Math.floor(now.getTime() / 30_000) + 1;
  await db.execute(sql`
    insert into rate_limit (id, key, count, last_request) values (${crypto.randomUUID()}, ${`astro-totp-step:${userId}`}, ${step}, ${now.getTime()})
    on conflict (key) do update set count = greatest(rate_limit.count, excluded.count), last_request = excluded.last_request`);
}
