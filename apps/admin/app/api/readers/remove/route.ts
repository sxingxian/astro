import { z } from "zod";
import { inTransaction, logAudit } from "@/lib/audit";
import { json, mutation, requireCan } from "@/lib/http";
import { removeReader } from "@/lib/readers";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

/** Removes someone's reader role. Their log is locked, not deleted. */
export const POST = mutation(z.object({ userId: z.string().min(1).max(64), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.manage");
  await stepUp(user, body.code);
  await inTransaction(async (tx) => {
    const done = await removeReader(tx, user, body.userId);
    await logAudit(user, request, { action: "reader.remove", entity: "user", entityId: body.userId, summary: done }, tx);
  });
  return json({ ok: true });
});
