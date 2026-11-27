import type { Db } from "@astro/db";
import { acceptRoleOffer, audit } from "@astro/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Accepts a role offer made to the signed-in account. `guidelines` is the version their page showed (readers only). */
export const POST = mutation(z.object({ offerId: z.uuid(), guidelines: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }), async ({ request, user, body }) => {
  const result = await getDb().transaction(async (t) => {
    const tx = t as unknown as Db;
    const r = await acceptRoleOffer(tx, { offerId: body.offerId, userId: user.id, guidelines: body.guidelines });
    if (r.ok) {
      await audit(tx, { actorId: user.id, actorRole: r.roles.portal ?? (r.roles.reader ? "reader" : null), action: "reader.accept", entity: "role_offer", entityId: body.offerId, summary: { reader: r.roles.reader, portalRole: r.roles.portal ?? "none" }, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
    }
    return r;
  });
  return result.ok ? json(result.roles) : fail(result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
});
