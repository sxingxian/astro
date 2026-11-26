import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { revokeInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ inviteId: z.uuid(), code: z.string().max(6) }), async ({ user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  await revokeInvite(getDb(), user, body.inviteId);
  return json({ ok: true });
});
