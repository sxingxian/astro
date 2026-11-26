import { z } from "zod";
import { addService, updateService } from "@/lib/ai";
import { alertOwner, apiKey, serviceFields } from "@/lib/ai-routes";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError, json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

/** Adds a service (with its key, behind a fresh code) or edits one (never its key: see /api/ai/key). */
export const POST = mutation(serviceFields.extend({ id: z.uuid().optional(), key: apiKey.optional(), code: z.string().max(6).optional() }), async ({ request, user, body }) => {
  const db = getDb();
  const { id, key, code, ...input } = body;
  if (id) {
    if (key) throw new HttpError(400, "use_key_route");
    await updateService(db, user.id, id, input);
    await logAudit(user, request, { action: "ai.service_update", entity: "ai_service", entityId: id, summary: { serviceId: id, provider: input.provider, name: input.name, company: input.company, model: input.model, enabled: input.enabled } });
    return json({ id });
  }
  if (!key) throw new HttpError(400, "key_required");
  await stepUp(user, code ?? "");
  const added = await addService(db, user.id, input, key, getEnv().AI_KEY_ENCRYPTION_KEY);
  await logAudit(user, request, { action: "ai.service_add", entity: "ai_service", entityId: added.id, summary: { serviceId: added.id, provider: input.provider, name: input.name, company: input.company, model: input.model } });
  await logAudit(user, request, { action: "ai.key_change", entity: "ai_service", entityId: added.id, summary: { serviceId: added.id, provider: input.provider, last4: added.last4 } });
  await alertOwner(user, input.name, added.last4);
  return json({ id: added.id, last4: added.last4 });
}, (user) => requireCan(user, "ai.edit"));
