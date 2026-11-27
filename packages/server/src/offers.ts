import { sql, type Db } from "@astro/db";
import { ACCEPT_REASONS, type AcceptReason } from "./invite";
import type { Role } from "./roles";

export type OfferResult = { ok: true; roles: { portal: Role | null; reader: boolean } } | { ok: false; reason: Exclude<AcceptReason, "wrong_email"> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accepts a role offer made to the signed-in account, through accept_role_offer (migration 0006): the offer must be
 * this account's, unused and unexpired, with 2-step sign-in on; only the owner's offers make staff readers; the
 * reader role needs the newest guidelines version. The app's database user can't write roles any other way.
 */
export async function acceptRoleOffer(db: Db, { offerId, userId, guidelines }: { offerId: string; userId: string; guidelines: number }): Promise<OfferResult> {
  if (!UUID.test(offerId)) return { ok: false, reason: "invalid" };
  const [row] = await db.execute<{ r: string }>(sql`select accept_role_offer(${offerId}::uuid, ${userId}, ${guidelines}) as r`);
  const r = row?.r ?? "invalid";
  if (r.startsWith("ok:")) {
    const parts = r.slice(3).split("+");
    const portal = parts.find((p) => p === "admin" || p === "moderator") ?? null;
    return { ok: true, roles: { portal: portal as Role | null, reader: parts.includes("reader") } };
  }
  return { ok: false, reason: (ACCEPT_REASONS.has(r) && r !== "wrong_email" ? r : "invalid") as Exclude<AcceptReason, "wrong_email"> };
}
