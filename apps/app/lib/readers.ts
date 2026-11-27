import { sql, type Db } from "@astro/db";
import { HttpError } from "@astro/server";

export interface ReaderStatus {
  reader: boolean;
  /** The newest published reader guidelines version; 0 means the built-in default. */
  guidelinesVersion: number;
  /** Whether they accepted that version. Desk asks again after the guidelines are republished. */
  accepted: boolean;
}

export async function readerStatus(db: Db, userId: string): Promise<ReaderStatus> {
  const [r] = await db.execute<{ reader: boolean; version: string; accepted: boolean }>(sql`
    select exists(select 1 from reader_role where user_id = ${userId} and revoked_at is null) as reader,
           v.version,
           exists(select 1 from guideline_acceptance a where a.user_id = ${userId} and a.version = v.version) as accepted
    from (select coalesce(max(id), 0) as version from text_version where kind = 'guidelines') v`);
  return { reader: Boolean(r?.reader), guidelinesVersion: Number(r?.version ?? 0), accepted: Boolean(r?.reader && r?.accepted) };
}

/** Records that a reader accepted the guidelines — only the newest version, so nobody accepts wording they weren't shown. */
export async function acceptGuidelines(db: Db, userId: string, version: number): Promise<void> {
  const s = await readerStatus(db, userId);
  if (!s.reader) throw new HttpError(403, "not_reader");
  if (version !== s.guidelinesVersion) throw new HttpError(409, "guidelines_changed");
  await db.execute(sql`insert into guideline_acceptance (user_id, version) values (${userId}, ${version}) on conflict do nothing`);
}

export interface PendingOffer {
  id: string;
  reader: boolean;
  portalRole: "admin" | "moderator" | null;
  expiresAt: Date;
}

/** The newest offer made to this account that is still open. */
export async function pendingOffer(db: Db, userId: string): Promise<PendingOffer | null> {
  const [o] = await db.execute<{ id: string; reader: boolean; portal_role: "admin" | "moderator" | null; expires_at: string }>(sql`
    select id, reader, portal_role, expires_at from role_offer
    where user_id = ${userId} and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at desc limit 1`);
  return o ? { id: o.id, reader: o.reader, portalRole: o.portal_role, expiresAt: new Date(o.expires_at) } : null;
}

/** A reader giving up their own role. Their log is locked, not deleted. */
export async function giveUpReaderRole(db: Db, userId: string): Promise<void> {
  await db.execute(sql`select give_up_reader_role(${userId})`);
}
