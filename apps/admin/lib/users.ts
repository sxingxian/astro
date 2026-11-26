import { and, eq, isNull, schema, sql, type Db } from "@astro/db";
import { HttpError } from "@astro/server";
import type { Actor } from "./team";

/** What support may see about a person. Never notes, check-in notes or what readings said. */
export interface UserFacts {
  id: string;
  email: string;
  createdAt: Date;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** The newest session still on record; signing out removes sessions, so this can be empty. */
  lastSignInAt: Date | null;
  readingCount: number;
  disabledAt: Date | null;
}

/** Exact, case-insensitive email match. No partial matches and no list, so staff can't browse people. */
export async function findUser(db: Db, email: string): Promise<UserFacts | null> {
  const [u] = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      createdAt: schema.user.createdAt,
      emailVerified: schema.user.emailVerified,
      twoFactorEnabled: schema.user.twoFactorEnabled,
      disabledAt: schema.user.disabledAt,
      lastSignInAt: sql<string | null>`(select max(created_at) from session s where s.user_id = "user".id)`,
      readingCount: sql<number>`(select count(*)::int from draw_session d where d.user_id = "user".id and d.status = 'complete')`
    })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${email.trim()})`);
  if (!u) return null;
  return { ...u, lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt) : null };
}

/** Loads the target and applies the shared rules: not yourself, and staff accounts only by the owner. */
async function target(db: Db, actor: Actor, userId: string): Promise<{ email: string; staffRole: string | null }> {
  if (userId === actor.id) throw new HttpError(403, "self");
  const [t] = await db
    .select({ email: schema.user.email, staffRole: schema.staffRole.role })
    .from(schema.user)
    .leftJoin(schema.staffRole, and(eq(schema.staffRole.userId, schema.user.id), isNull(schema.staffRole.revokedAt)))
    .where(eq(schema.user.id, userId));
  if (!t) throw new HttpError(404, "not_found");
  if (t.staffRole && actor.role !== "owner") throw new HttpError(403, "staff_owner_only");
  return t;
}

const endAllSessions = (db: Db, userId: string) => db.delete(schema.session).where(eq(schema.session.userId, userId));

/** Stops sign-in and signs them out on every device, in the app and the portal. */
export async function disableUser(db: Db, actor: Actor, userId: string): Promise<{ email: string }> {
  const t = await target(db, actor, userId);
  await db.transaction(async (tx) => {
    await tx.update(schema.user).set({ disabledAt: new Date(), updatedAt: new Date() }).where(eq(schema.user.id, userId));
    await endAllSessions(tx as unknown as Db, userId);
  });
  return { email: t.email };
}

export async function enableUser(db: Db, actor: Actor, userId: string): Promise<{ email: string }> {
  const t = await target(db, actor, userId);
  await db.update(schema.user).set({ disabledAt: null, updatedAt: new Date() }).where(eq(schema.user.id, userId));
  return { email: t.email };
}

/** For someone who lost their authenticator: removes it and signs them out, so they set it up again. */
export async function resetTwoStep(db: Db, actor: Actor, userId: string): Promise<{ email: string }> {
  const t = await target(db, actor, userId);
  await db.transaction(async (tx) => {
    await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
    await tx.update(schema.user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, userId));
    await endAllSessions(tx as unknown as Db, userId);
  });
  return { email: t.email };
}
