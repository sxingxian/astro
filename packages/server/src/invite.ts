import { eq, schema, sql, type Db } from "@astro/db";
import type { Role } from "./roles";

export const INVITE_HOURS = 72;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** SHA-256 of the token: the only form stored in the database. */
export async function hashInviteToken(token: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** A new invite token: 32 random bytes as base64url (43 characters), and its hash. */
export async function newInviteToken(): Promise<{ token: string; hash: Uint8Array }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = b64url(bytes);
  return { token, hash: await hashInviteToken(token) };
}

export type AcceptResult = { ok: true; role: Role } | { ok: false; reason: "invalid" | "expired" | "wrong_email" | "two_step_required" | "has_role" };

interface AcceptInput {
  token: string;
  user: { id: string; email: string; twoFactorEnabled: boolean };
  now: Date;
}

/**
 * Accepts an invite for the signed-in person. The invite must be unused, unexpired and unrevoked, for the
 * same email, and the person must have 2-step sign-in on. One transaction, with the invite row locked, so a
 * token can only ever be used once.
 */
export async function acceptInvite(db: Db, { token, user, now }: AcceptInput): Promise<AcceptResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };
  const hash = await hashInviteToken(token);
  return db.transaction(async (tx) => {
    const [inv] = await tx.execute<{ id: string; email: string; role: Role; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null }>(
      sql`select id, email, role, expires_at, accepted_at, revoked_at from invite where token_hash = ${hash} for update`
    );
    if (!inv || inv.accepted_at || inv.revoked_at) return { ok: false, reason: "invalid" } as const;
    if (new Date(inv.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expired" } as const;
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) return { ok: false, reason: "wrong_email" } as const;
    if (!user.twoFactorEnabled) return { ok: false, reason: "two_step_required" } as const;
    const existing = await tx.execute(sql`select 1 from staff_role where user_id = ${user.id}`);
    if (existing.length > 0) return { ok: false, reason: "has_role" } as const;
    await tx.insert(schema.staffRole).values({ userId: user.id, role: inv.role });
    await tx.update(schema.invite).set({ acceptedAt: now }).where(eq(schema.invite.id, inv.id));
    return { ok: true, role: inv.role } as const;
  });
}
