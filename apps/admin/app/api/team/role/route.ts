import { inTransaction, logAudit } from "@/lib/audit";
import { z } from "zod";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { changeRole } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ userId: z.string().min(1).max(64), role: z.enum(["admin", "moderator"]), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.manage");
  await stepUp(user, body.code);
  const r = await inTransaction(async (tx) => {
    const done = await changeRole(tx, user, body.userId, body.role);
    await logAudit(user, request, { action: "team.role", entity: "user", entityId: body.userId, summary: done }, tx);
    return done;
  });
  return json({ from: r.from, to: r.to });
});
