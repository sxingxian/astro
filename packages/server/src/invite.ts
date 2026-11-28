import { rowsOf, sql, type AnyDb } from "@astro/db";
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

export type AcceptReason = "invalid" | "expired" | "wrong_email" | "two_step_required" | "has_role" | "staff_reader_owner_only" | "guidelines_changed";
export type AcceptResult = { ok: true; role: Role } | { ok: false; reason: AcceptReason };

export const ACCEPT_REASONS: ReadonlySet<string> = new Set<AcceptReason>(["invalid", "expired", "wrong_email", "two_step_required", "has_role", "staff_reader_owner_only", "guidelines_changed"]);

/**
 * Accepts an invite for the signed-in person, through the database function accept_invite (migration 0003). It
 * checks, with the invite row locked, that the invite is unused, unexpired and unrevoked, for this person's email,
 * that they have 2-step sign-in on and no role yet, then grants the role. The app's database user can't write roles
 * any other way. `guidelines` is the reader-guidelines version the person read (migration 0006): a reader invite is
 * refused with `guidelines_changed` unless it is the newest; 0 means the built-in default.
 */
export async function acceptInvite(db: AnyDb, { token, userId, guidelines = 0 }: { token: string; userId: string; guidelines?: number }): Promise<AcceptResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };
  const hash = await hashInviteToken(token);
  const [row] = rowsOf<{ r: string }>(await db.execute(sql`select accept_invite(${Buffer.from(hash)}, ${userId}, ${guidelines}) as r`));
  const r = row?.r ?? "invalid";
  if (r.startsWith("ok:")) return { ok: true, role: r.slice(3) as Role };
  return { ok: false, reason: (ACCEPT_REASONS.has(r) ? r : "invalid") as AcceptReason };
}
