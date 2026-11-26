import { and, desc, eq, gte, inArray, lt, schema, sql, type Db } from "@astro/db";

/**
 * Every action the audit log records, with the only summary keys it may carry. Anything else is refused,
 * so keys, passwords and free text can't end up in the log. Later tasks add their actions here.
 */
export const AUDIT_ACTIONS = {
  "auth.sign_in": ["method", "country"],
  "team.invite": ["email", "role", "expiresAt"],
  "team.revoke": ["email", "role"],
  "team.role": ["email", "from", "to"],
  "team.remove": ["email", "role"],
  "team.accept": ["role"],
  "user.find": ["email", "found"],
  "user.disable": ["email"],
  "user.enable": ["email"],
  "user.reset_2fa": ["email"],
  "settings.change": ["setting", "value"],
  "ai.service_add": ["serviceId", "provider", "name", "company", "model"],
  "ai.service_update": ["serviceId", "provider", "name", "company", "model", "enabled"],
  "ai.key_change": ["serviceId", "provider", "last4"],
  "ai.test": ["serviceId", "ok", "ms", "failure"],
  "ai.roles": ["companies", "warning"],
  "audit.export": ["rows"]
} as const satisfies Record<string, readonly string[]>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
type SummaryValue = string | number | boolean;
const MAX_VALUE = 200;

export interface AuditEntry {
  actorId: string | null;
  actorRole: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string;
  summary: Partial<Record<(typeof AUDIT_ACTIONS)[AuditAction][number], SummaryValue>>;
  ip?: string | null;
}

export class AuditSummaryError extends Error {}

async function hashIp(ip: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + secret));
  return Buffer.from(digest).toString("hex").slice(0, 16);
}

/** Appends one entry. `secret` keys the IP hash (BETTER_AUTH_SECRET), so the log can link visits without storing IPs. */
export async function audit(db: Db, entry: AuditEntry, secret: string): Promise<void> {
  const allowed: readonly string[] = AUDIT_ACTIONS[entry.action];
  if (!allowed) throw new AuditSummaryError(`unknown action ${entry.action}`);
  for (const [k, v] of Object.entries(entry.summary)) {
    if (!allowed.includes(k)) throw new AuditSummaryError(`${entry.action} can't record "${k}"`);
    if (typeof v === "string" ? v.length > MAX_VALUE : typeof v !== "number" && typeof v !== "boolean") throw new AuditSummaryError(`${entry.action}.${k} is too long or not a plain value`);
  }
  await db.insert(schema.auditLog).values({
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    summary: entry.summary,
    ipHash: entry.ip ? await hashIp(entry.ip, secret) : null
  });
}

export interface AuditFilter {
  actorId?: string;
  actions?: string[];
  /** Inclusive. */
  from?: Date;
  /** Exclusive. */
  to?: Date;
  /** The last id of the previous page. */
  cursor?: number;
}

export interface AuditRow {
  id: number;
  at: Date;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: Record<string, SummaryValue>;
}

export const AUDIT_PAGE = 50;

/** Newest first, `limit` at a time (50 on screen; the CSV export asks for more). */
export async function listAudit(db: Db, f: AuditFilter, limit = AUDIT_PAGE): Promise<{ entries: AuditRow[]; nextCursor: number | null }> {
  const t = schema.auditLog;
  const rows = await db
    .select({ id: t.id, at: t.at, actorId: t.actorId, actorEmail: schema.user.email, actorRole: t.actorRole, action: t.action, entity: t.entity, entityId: t.entityId, summary: t.summary })
    .from(t)
    .leftJoin(schema.user, eq(schema.user.id, t.actorId))
    .where(
      and(
        f.actorId ? eq(t.actorId, f.actorId) : undefined,
        // An empty list means "a group with no actions yet": nothing matches.
        f.actions ? (f.actions.length ? inArray(t.action, f.actions) : sql`false`) : undefined,
        f.from ? gte(t.at, f.from) : undefined,
        f.to ? lt(t.at, f.to) : undefined,
        f.cursor ? lt(t.id, f.cursor) : undefined
      )
    )
    .orderBy(desc(t.id))
    .limit(limit + 1);
  const entries = rows.slice(0, limit) as AuditRow[];
  return { entries, nextCursor: rows.length > limit ? entries.at(-1)!.id : null };
}
