import { inTransaction, logAudit } from "@/lib/audit";
import { z } from "zod";
import { getMailer } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { createInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.email().max(254), role: z.enum(["admin", "moderator", "reader"]), code: z.string().max(6) });

export const POST = mutation(body, async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  const result = await inTransaction(async (tx) => {
    const r = await createInvite(tx, user, { email: body.email, role: body.role }, new Date(), { sendMail: (m) => getMailer().send(m), appUrl: getEnv().APP_URL });
    await logAudit(user, request, { action: "team.invite", entity: "invite", entityId: r.inviteId, summary: { email: body.email.trim().toLowerCase(), role: body.role, expiresAt: r.expiresAt.toISOString() } }, tx);
    return r;
  });
  return json(result);
});
