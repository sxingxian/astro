import { and, eq, isNull, schema, type Db } from "@astro/db";
import { canGrant, canOfferReader, canRemoveReader, HttpError, INVITE_HOURS, roleOfferEmail, type EmailT, type Mail } from "@astro/server";
import type { Actor } from "./team";

type PortalOffer = "admin" | "moderator" | null;

interface OfferDeps {
  sendMail: (m: Mail) => Promise<void>;
  appUrl: string;
  emailT?: EmailT;
}

/** The person's email, active portal role and whether they're an active reader. */
async function holder(db: Db, userId: string): Promise<{ email: string; staffRole: string | null; reader: boolean } | null> {
  const [t] = await db
    .select({ email: schema.user.email, staffRole: schema.staffRole.role, readerSince: schema.readerRole.grantedAt })
    .from(schema.user)
    .leftJoin(schema.staffRole, and(eq(schema.staffRole.userId, schema.user.id), isNull(schema.staffRole.revokedAt)))
    .leftJoin(schema.readerRole, and(eq(schema.readerRole.userId, schema.user.id), isNull(schema.readerRole.revokedAt)))
    .where(eq(schema.user.id, userId));
  return t ? { email: t.email, staffRole: t.staffRole, reader: t.readerSince !== null } : null;
}

/** The checks shared by sending and withdrawing an offer: the actor could give every role it carries. */
export function mayOffer(actor: Pick<Actor, "role">, targetIsStaff: boolean, o: { reader: boolean; portalRole: PortalOffer }): boolean {
  if (actor.role !== "owner" && actor.role !== "admin") return false;
  if (o.portalRole && !canGrant(actor.role, o.portalRole)) return false;
  return !o.reader || canOfferReader(actor.role, targetIsStaff || o.portalRole !== null);
}

/**
 * Offers an existing account the reader role, a portal role, or both. Valid for 72 hours, and replaces any earlier
 * pending offer to that account. Nothing changes until they accept in the app (accept_role_offer, migration 0006).
 */
export async function offerRole(db: Db, actor: Actor, input: { userId: string; reader: boolean; portalRole: PortalOffer }, now: Date, deps: OfferDeps): Promise<{ offerId: string; expiresAt: Date; email: string }> {
  if (!input.reader && !input.portalRole) throw new HttpError(400, "invalid_input");
  if (input.userId === actor.id) throw new HttpError(403, "self");
  const t = await holder(db, input.userId);
  if (!t) throw new HttpError(404, "not_found");
  if (!mayOffer(actor, t.staffRole !== null, input)) throw new HttpError(403, "forbidden_role");
  if ((input.portalRole && t.staffRole) || (input.reader && t.reader)) throw new HttpError(409, "has_role");
  const expiresAt = new Date(now.getTime() + INVITE_HOURS * 3600_000);
  const [row] = await db.transaction(async (tx) => {
    await tx.update(schema.roleOffer).set({ revokedAt: now }).where(and(eq(schema.roleOffer.userId, input.userId), isNull(schema.roleOffer.acceptedAt), isNull(schema.roleOffer.revokedAt)));
    return tx.insert(schema.roleOffer).values({ userId: input.userId, reader: input.reader, portalRole: input.portalRole, offeredBy: actor.id, expiresAt }).returning({ id: schema.roleOffer.id });
  });
  await deps.sendMail(roleOfferEmail(t.email, input, `${deps.appUrl}/offer`, expiresAt, deps.emailT));
  return { offerId: row!.id, expiresAt, email: t.email };
}

/** Withdraws a pending offer the actor could have sent. */
export async function revokeOffer(db: Db, actor: Actor, offerId: string): Promise<{ email: string; reader: boolean; portalRole: PortalOffer }> {
  const [o] = await db.select({ userId: schema.roleOffer.userId, reader: schema.roleOffer.reader, portalRole: schema.roleOffer.portalRole }).from(schema.roleOffer).where(and(eq(schema.roleOffer.id, offerId), isNull(schema.roleOffer.acceptedAt), isNull(schema.roleOffer.revokedAt)));
  if (!o) throw new HttpError(404, "not_found");
  const t = await holder(db, o.userId);
  if (!t) throw new HttpError(404, "not_found");
  if (!mayOffer(actor, t.staffRole !== null, o)) throw new HttpError(403, "forbidden_role");
  await db.update(schema.roleOffer).set({ revokedAt: new Date() }).where(eq(schema.roleOffer.id, offerId));
  return { email: t.email, reader: o.reader, portalRole: o.portalRole };
}

/** The owner adds the reader role to their own account (they accept the guidelines in the app before using Desk). */
export async function addReaderToSelf(db: Db, actor: Actor): Promise<{ email: string }> {
  if (actor.role !== "owner") throw new HttpError(403, "forbidden_role");
  const t = await holder(db, actor.id);
  if (!t) throw new HttpError(404, "not_found");
  if (t.reader) throw new HttpError(409, "has_role");
  await db
    .insert(schema.readerRole)
    .values({ userId: actor.id, grantedBy: actor.id })
    .onConflictDoUpdate({ target: schema.readerRole.userId, set: { grantedBy: actor.id, grantedAt: new Date(), revokedAt: null } });
  return { email: t.email };
}

/** Removes someone's reader role. The row stays (revoked_at set), so their log is locked, not deleted. */
export async function removeReader(db: Db, actor: Actor, userId: string): Promise<{ email: string }> {
  const t = await holder(db, userId);
  if (!t || !t.reader) throw new HttpError(404, "not_found");
  if (!canRemoveReader(actor.role, t.staffRole !== null, userId === actor.id)) throw new HttpError(403, "forbidden_role");
  await db.update(schema.readerRole).set({ revokedAt: new Date() }).where(and(eq(schema.readerRole.userId, userId), isNull(schema.readerRole.revokedAt)));
  return { email: t.email };
}
