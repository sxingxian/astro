import type { Db } from "@astro/db";
import { audit, type AuditEntry } from "@astro/server";
import { getDb } from "./db";
import { getEnv } from "./env";

/**
 * Records what a staff member did. Pass the transaction the change ran in, so the change and its entry are saved
 * together or not at all (see inTransaction).
 */
export function logAudit(actor: { id: string; role: string }, request: Request, entry: Omit<AuditEntry, "actorId" | "actorRole" | "ip">, db: Db = getDb()): Promise<void> {
  return audit(db, { ...entry, actorId: actor.id, actorRole: actor.role, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
}

/** Runs a change and its audit entries in one transaction. Never hold it across a call to another service. */
export const inTransaction = <T>(fn: (tx: Db) => Promise<T>): Promise<T> => getDb().transaction((tx) => fn(tx as unknown as Db));
