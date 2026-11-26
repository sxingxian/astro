import { inTransaction, logAudit } from "@/lib/audit";
import { z } from "zod";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { revokeInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ inviteId: z.uuid(), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  await inTransaction(async (tx) => {
    const inv = await revokeInvite(tx, user, body.inviteId);
    await logAudit(user, request, { action: "team.revoke", entity: "invite", entityId: body.inviteId, summary: inv }, tx);
  });
  return json({ ok: true });
});
