import { sql, type Db } from "@astro/db";
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

const REASONS = new Set(["invalid", "expired", "wrong_email", "two_step_required", "has_role"]);

/**
 * Accepts an invite for the signed-in person, through the database function accept_invite (migration 0003). It
 * checks, with the invite row locked, that the invite is unused, unexpired and unrevoked, for this person's email,
 * that they have 2-step sign-in on and no role yet, then grants the role. The app's database user can't write roles
 * any other way.
 */
export async function acceptInvite(db: Db, { token, userId }: { token: string; userId: string }): Promise<AcceptResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };
  const hash = await hashInviteToken(token);
  const [row] = await db.execute<{ r: string }>(sql`select accept_invite(${Buffer.from(hash)}, ${userId}) as r`);
  const r = row?.r ?? "invalid";
  if (r.startsWith("ok:")) return { ok: true, role: r.slice(3) as Role };
  return { ok: false, reason: (REASONS.has(r) ? r : "invalid") as Exclude<AcceptResult, { ok: true }>["reason"] };
}
