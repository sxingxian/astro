import { z } from "zod";
import { listServices, saveRoles } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { fail, json, mutation, requireCan } from "@/lib/http";

export const dynamic = "force-dynamic";

const slot = z.object({ role: z.enum(["writer", "checker_1", "checker_2"]), position: z.number().int().min(0).max(9), serviceId: z.uuid() });

export const POST = mutation(z.object({ slots: z.array(slot).max(30) }), async ({ request, user, body }) => {
  const db = getDb();
  const result = await saveRoles(db, body.slots);
  if (!result.ok) return fail(400, "invalid_roles", { errors: result.errors });
  const services = await listServices(db);
  const companies = new Set(body.slots.map((s) => services.find((x) => x.id === s.serviceId)?.company.trim().toLowerCase())).size;
  await logAudit(user, request, { action: "ai.roles", entity: "ai_role_slot", summary: { companies, warning: result.warnings.includes("fragile") } });
  return json(result);
}, (user) => requireCan(user, "ai.edit"));
