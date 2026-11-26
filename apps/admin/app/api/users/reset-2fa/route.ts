import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { findUser, resetTwoStep } from "@/lib/users";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ userId: z.string().min(1).max(64), code: z.string().max(6) }), async ({ request, user, body }) => {
  requireCan(user, "users.help");
  await stepUp(user, body.code);
  const db = getDb();
  const { email } = await resetTwoStep(db, user, body.userId);
  await logAudit(user, request, { action: "user.reset_2fa", entity: "user", entityId: body.userId, summary: { email } });
  return json({ user: await findUser(db, email) });
});
