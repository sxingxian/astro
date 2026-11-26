import { inTransaction, logAudit } from "@/lib/audit";
import { z } from "zod";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { removeRole } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ userId: z.string().min(1).max(64), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.manage");
  await stepUp(user, body.code);
  const r = await inTransaction(async (tx) => {
    const done = await removeRole(tx, user, body.userId);
    await logAudit(user, request, { action: "team.remove", entity: "user", entityId: body.userId, summary: done }, tx);
    return done;
  });
  return json({ role: r.role });
});
