import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { revokeInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ inviteId: z.uuid(), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  const inv = await revokeInvite(getDb(), user, body.inviteId);
  await logAudit(user, request, { action: "team.revoke", entity: "invite", entityId: body.inviteId, summary: inv });
  return json({ ok: true });
});
