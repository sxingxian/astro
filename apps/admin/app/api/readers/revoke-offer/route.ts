import { z } from "zod";
import { inTransaction, logAudit } from "@/lib/audit";
import { json, mutation, requireCan } from "@/lib/http";
import { revokeOffer } from "@/lib/readers";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ offerId: z.uuid(), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  await inTransaction(async (tx) => {
    const done = await revokeOffer(tx, user, body.offerId);
    await logAudit(user, request, { action: "reader.revoke_offer", entity: "role_offer", entityId: body.offerId, summary: { ...done, portalRole: done.portalRole ?? "none" } }, tx);
  });
  return json({ ok: true });
});
