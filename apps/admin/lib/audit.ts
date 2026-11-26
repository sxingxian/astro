import { audit, type AuditEntry } from "@astro/server";
import { getDb } from "./db";
import { getEnv } from "./env";

/** Records what a staff member just did. Call after the action succeeds, in every portal mutation. */
export function logAudit(actor: { id: string; role: string }, request: Request, entry: Omit<AuditEntry, "actorId" | "actorRole" | "ip">): Promise<void> {
  return audit(getDb(), { ...entry, actorId: actor.id, actorRole: actor.role, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
}
