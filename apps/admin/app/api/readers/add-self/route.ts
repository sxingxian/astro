import { z } from "zod";
import { inTransaction, logAudit } from "@/lib/audit";
import { json, mutation, requireCan } from "@/lib/http";
import { addReaderToSelf } from "@/lib/readers";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

/** The owner adds the reader role to their own account. */
export const POST = mutation(z.object({ code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  await inTransaction(async (tx) => {
    const done = await addReaderToSelf(tx, user);
    await logAudit(user, request, { action: "reader.add", entity: "user", entityId: user.id, summary: done }, tx);
  });
  return json({ ok: true });
});
