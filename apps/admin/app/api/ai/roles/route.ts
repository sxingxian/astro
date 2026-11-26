import { z } from "zod";
import { listServices, saveRoles } from "@/lib/ai";
import { inTransaction, logAudit } from "@/lib/audit";
import { fail, json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";

export const dynamic = "force-dynamic";

const slot = z.object({ role: z.enum(["writer", "checker_1", "checker_2"]), position: z.number().int().min(0).max(9), serviceId: z.uuid() });

export const POST = mutation(z.object({ slots: z.array(slot).max(30), code: z.string().max(6).optional() }), async ({ request, user, body }) => {
  await stepUp(user, body.code ?? "");
  const result = await inTransaction(async (tx) => {
    const r = await saveRoles(tx, body.slots);
    if (!r.ok) return r;
    const services = await listServices(tx);
    const companies = new Set(body.slots.map((s) => services.find((x) => x.id === s.serviceId)?.company.trim().toLowerCase())).size;
    await logAudit(user, request, { action: "ai.roles", entity: "ai_role_slot", summary: { companies, warning: r.warnings.includes("fragile") } }, tx);
    return r;
  });
  if (!result.ok) return fail(400, "invalid_roles", { errors: result.errors });
  return json(result);
}, (user) => requireCan(user, "ai.edit"));
