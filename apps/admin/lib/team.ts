import { and, eq, isNull, schema, sql, type Db } from "@astro/db";
import { canGrant, HttpError, INVITE_HOURS, inviteEmail, newInviteToken, type EmailT, type Mail, type Role, type StaffRole } from "@astro/server";

export interface Actor {
  id: string;
  role: Role;
}

interface InviteDeps {
  sendMail: (m: Mail) => Promise<void>;
  appUrl: string;
  /** The published email wording; defaults when left out. */
  emailT?: EmailT;
}

export interface TeamMember {
  userId: string;
  email: string;
  /** Their portal role, if any. */
  role: StaffRole | null;
  /** Holds the reader role now. */
  reader: boolean;
  /** Lost the reader role in the last 30 days and has no other role: their log is locked. */
  formerReader: boolean;
  twoFactorEnabled: boolean;
  grantedAt: Date;
}

export interface TeamOffer {
  id: string;
  userId: string;
  email: string;
  reader: boolean;
  portalRole: "admin" | "moderator" | null;
  expiresAt: Date;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  expiresAt: Date;
  status: "pending" | "accepted" | "expired" | "cancelled";
}

/** Everyone with a portal role or the reader role, recent former readers, pending offers, and invites from the last 30 days. */
export async function listTeam(db: Db, now: Date): Promise<{ members: TeamMember[]; invites: TeamInvite[]; offers: TeamOffer[] }> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const people = await db.execute<{ user_id: string; email: string; two_factor_enabled: boolean; role: StaffRole | null; granted_at: string; reader: boolean }>(sql`
    select u.id as user_id, u.email, u.two_factor_enabled, s.role, coalesce(s.granted_at, r.granted_at) as granted_at, (r.user_id is not null and r.revoked_at is null) as reader
    from "user" u
    left join staff_role s on s.user_id = u.id and s.revoked_at is null
    left join reader_role r on r.user_id = u.id
    where s.user_id is not null or (r.user_id is not null and (r.revoked_at is null or r.revoked_at > ${since}))
    order by case s.role when 'owner' then 0 when 'admin' then 1 when 'moderator' then 2 else 3 end, u.email`);
  const members = people.map((p): TeamMember => ({ userId: p.user_id, email: p.email, role: p.role, reader: p.reader, formerReader: !p.role && !p.reader, twoFactorEnabled: p.two_factor_enabled, grantedAt: new Date(p.granted_at) }));
  const offers = await db
    .select({ id: schema.roleOffer.id, userId: schema.roleOffer.userId, email: schema.user.email, reader: schema.roleOffer.reader, portalRole: schema.roleOffer.portalRole, expiresAt: schema.roleOffer.expiresAt })
    .from(schema.roleOffer)
    .innerJoin(schema.user, eq(schema.user.id, schema.roleOffer.userId))
    .where(and(isNull(schema.roleOffer.acceptedAt), isNull(schema.roleOffer.revokedAt), sql`${schema.roleOffer.expiresAt} > ${now.toISOString()}`))
    .orderBy(sql`${schema.roleOffer.createdAt} desc`);
  const rows = await db
    .select({ id: schema.invite.id, email: schema.invite.email, role: schema.invite.role, createdAt: schema.invite.createdAt, expiresAt: schema.invite.expiresAt, acceptedAt: schema.invite.acceptedAt, revokedAt: schema.invite.revokedAt })
    .from(schema.invite)
    .where(sql`${schema.invite.createdAt} > ${new Date(now.getTime() - 30 * 86_400_000).toISOString()}`)
    .orderBy(sql`${schema.invite.createdAt} desc`);
  const invites = rows.map((r): TeamInvite => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    status: r.acceptedAt ? "accepted" : r.revokedAt ? "cancelled" : r.expiresAt.getTime() <= now.getTime() ? "expired" : "pending"
  }));
  return { members, invites, offers };
}

async function holderOf(db: Db, userId: string): Promise<{ role: StaffRole; email: string } | null> {
  const [r] = await db
    .select({ role: schema.staffRole.role, email: schema.user.email })
    .from(schema.staffRole)
    .innerJoin(schema.user, eq(schema.user.id, schema.staffRole.userId))
    .where(and(eq(schema.staffRole.userId, userId), isNull(schema.staffRole.revokedAt)));
  return r ?? null;
}

const endPortalSessions = (db: Db, userId: string) => db.delete(schema.session).where(and(eq(schema.session.userId, userId), eq(schema.session.surface, "admin")));

/**
 * Invites someone by email. Only roles the actor may grant; never someone who already has a role. Replaces any
 * earlier pending invite for that email. The link opens the app, valid for 72 hours; only its hash is stored.
 */
export async function createInvite(db: Db, actor: Actor, input: { email: string; role: Exclude<Role, "owner"> }, now: Date, deps: InviteDeps): Promise<{ inviteId: string; expiresAt: Date }> {
  if (!canGrant(actor.role, input.role)) throw new HttpError(403, "forbidden_role");
  const email = input.email.trim().toLowerCase();
  const holder = await db.execute(sql`select 1 from staff_role s join "user" u on u.id = s.user_id where lower(u.email) = ${email} and s.revoked_at is null`);
  if (holder.length > 0) throw new HttpError(409, "has_role");
  const { token, hash } = await newInviteToken();
  const expiresAt = new Date(now.getTime() + INVITE_HOURS * 3600_000);
  const [row] = await db.transaction(async (tx) => {
    await tx
      .update(schema.invite)
      .set({ revokedAt: now })
      .where(and(sql`lower(${schema.invite.email}) = ${email}`, isNull(schema.invite.acceptedAt), isNull(schema.invite.revokedAt)));
    return tx.insert(schema.invite).values({ email, role: input.role, tokenHash: hash, invitedBy: actor.id, expiresAt }).returning({ id: schema.invite.id });
  });
  // The token goes after "#", which browsers never send to a server, so it stays out of request logs.
  await deps.sendMail(inviteEmail(email, input.role, `${deps.appUrl}/invite#${token}`, expiresAt, deps.emailT));
  return { inviteId: row!.id, expiresAt };
}

/** Cancels a pending invite the actor could have sent. */
export async function revokeInvite(db: Db, actor: Actor, inviteId: string): Promise<{ email: string; role: Role }> {
  const [inv] = await db.select({ role: schema.invite.role, email: schema.invite.email }).from(schema.invite).where(eq(schema.invite.id, inviteId));
  if (!inv) throw new HttpError(404, "not_found");
  if (!canGrant(actor.role, inv.role)) throw new HttpError(403, "forbidden_role");
  await db.update(schema.invite).set({ revokedAt: new Date() }).where(and(eq(schema.invite.id, inviteId), isNull(schema.invite.acceptedAt)));
  return inv;
}

/** Changes someone's role. Both the old and the new role must be ones the actor may grant. Ends their portal sessions. */
export async function changeRole(db: Db, actor: Actor, userId: string, role: Exclude<StaffRole, "owner">): Promise<{ from: StaffRole; to: StaffRole; email: string }> {
  if (userId === actor.id) throw new HttpError(403, "self");
  const holder = await holderOf(db, userId);
  if (!holder) throw new HttpError(404, "not_found");
  const current = holder.role;
  if (current === "owner") throw new HttpError(403, "owner");
  if (!canGrant(actor.role, current) || !canGrant(actor.role, role)) throw new HttpError(403, "forbidden_role");
  await db.update(schema.staffRole).set({ role, grantedBy: actor.id, grantedAt: new Date() }).where(eq(schema.staffRole.userId, userId));
  await endPortalSessions(db, userId);
  return { from: current, to: role, email: holder.email };
}

/** Removes someone's role (their account stays). The owner can't be removed. Ends their portal sessions. */
export async function removeRole(db: Db, actor: Actor, userId: string): Promise<{ role: Role; email: string }> {
  if (userId === actor.id) throw new HttpError(403, "self");
  const holder = await holderOf(db, userId);
  if (!holder) throw new HttpError(404, "not_found");
  const current = holder.role;
  if (current === "owner") throw new HttpError(403, "owner");
  if (!canGrant(actor.role, current)) throw new HttpError(403, "forbidden_role");
  await db.delete(schema.staffRole).where(eq(schema.staffRole.userId, userId));
  await endPortalSessions(db, userId);
  return { role: current, email: holder.email };
}
