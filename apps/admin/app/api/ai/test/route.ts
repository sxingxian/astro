import { z } from "zod";
import { runTest, takeTestSlot } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError, json, mutation, requireCan } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ serviceId: z.uuid() }), async ({ request, user, body }) => {
  const db = getDb();
  if (!(await takeTestSlot(db, user.id))) throw new HttpError(429, "too_many_tests");
  const env = getEnv();
  const r = await runTest(db, body.serviceId, { masterHex: env.AI_KEY_ENCRYPTION_KEY, gatewayUrl: env.AI_GATEWAY_URL, fetchFn: fetch });
  await logAudit(user, request, { action: "ai.test", entity: "ai_service", entityId: body.serviceId, summary: { serviceId: body.serviceId, ok: r.ok, ms: r.ms, ...(r.failure ? { failure: r.failure } : {}) } });
  return json(r);
}, (user) => requireCan(user, "ai.edit"));
