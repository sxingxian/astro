import { z } from "zod";
import { replaceKey } from "@/lib/ai";
import { alertOwner, apiKey } from "@/lib/ai-routes";
import { inTransaction, logAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

/** Replaces a service's key. Write-only: the key never comes back, only its last 4 characters. */
export const POST = mutation(z.object({ serviceId: z.uuid(), key: apiKey, code: z.string().max(6) }), async ({ request, user, body }) => {
  await stepUp(user, body.code);
  const r = await inTransaction(async (tx) => {
    const done = await replaceKey(tx, user.id, body.serviceId, body.key, getEnv().AI_KEY_ENCRYPTION_KEY);
    await logAudit(user, request, { action: "ai.key_change", entity: "ai_service", entityId: body.serviceId, summary: { serviceId: body.serviceId, provider: done.provider, last4: done.last4 } }, tx);
    return done;
  });
  await alertOwner(user, r.name, r.last4);
  return json({ last4: r.last4 });
}, (user) => requireCan(user, "ai.edit"));
