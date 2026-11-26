import { and, asc, eq, schema, sql, type Db } from "@astro/db";
import { decryptKey, encryptKey, HttpError, testService, validateRoles, type AiRole, type Failure, type Provider, type RoleService, type Slot } from "@astro/server";

/** What the portal may show about a service. Never the key or its ciphertext. */
export interface PublicService {
  id: string;
  provider: Provider;
  name: string;
  company: string;
  baseUrl: string | null;
  model: string;
  keyLast4: string | null;
  enabled: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  cooldownUntil: Date | null;
}

const PUBLIC = {
  id: schema.aiService.id,
  provider: schema.aiService.provider,
  name: schema.aiService.name,
  company: schema.aiService.company,
  baseUrl: schema.aiService.baseUrl,
  model: schema.aiService.model,
  keyLast4: schema.aiService.keyLast4,
  enabled: schema.aiService.enabled,
  lastTestAt: schema.aiService.lastTestAt,
  lastTestOk: schema.aiService.lastTestOk,
  lastError: schema.aiService.lastError,
  cooldownUntil: schema.aiService.cooldownUntil
};

export const listServices = (db: Db): Promise<PublicService[]> => db.select(PUBLIC).from(schema.aiService).orderBy(asc(schema.aiService.name)) as Promise<PublicService[]>;
export const listSlots = (db: Db): Promise<Slot[]> =>
  db.select({ role: schema.aiRoleSlot.role, position: schema.aiRoleSlot.position, serviceId: schema.aiRoleSlot.serviceId }).from(schema.aiRoleSlot).orderBy(schema.aiRoleSlot.role, schema.aiRoleSlot.position);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** An "Other service" address: https on port 443, a real hostname (no IP addresses, no localhost or internal names). */
export function validateBaseUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "invalid_base_url");
  }
  const host = u.hostname.toLowerCase();
  const internal = host === "localhost" || /\.(localhost|local|internal|home|lan)$/.test(host) || !host.includes(".");
  if (u.protocol !== "https:" || (u.port !== "" && u.port !== "443") || IPV4.test(host) || host.startsWith("[") || internal || u.username || u.password || u.search || u.hash) {
    throw new HttpError(400, "invalid_base_url");
  }
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

export interface ServiceInput {
  provider: Provider;
  name: string;
  company: string;
  model: string;
  baseUrl?: string | null;
  enabled: boolean;
}

/** Adds a service with its key, encrypted with the row id bound in. The caller has checked a fresh code. */
export async function addService(db: Db, actorId: string, input: ServiceInput, key: string, masterHex: string): Promise<{ id: string; last4: string }> {
  const id = crypto.randomUUID();
  const baseUrl = input.provider === "openai_compatible" ? validateBaseUrl(input.baseUrl ?? "") : null;
  const box = await encryptKey(masterHex, key, id);
  const last4 = key.slice(-4);
  await db.insert(schema.aiService).values({ id, provider: input.provider, name: input.name, company: input.company, model: input.model, baseUrl, enabled: input.enabled, keyCiphertext: Buffer.from(box.ciphertext), keyIv: Buffer.from(box.iv), keyLast4: last4, updatedBy: actorId });
  return { id, last4 };
}

/** Edits everything but the key. Changing the provider, address or model means it must pass a test again. */
export async function updateService(db: Db, actorId: string, id: string, input: ServiceInput): Promise<void> {
  const [cur] = await db.select({ provider: schema.aiService.provider, baseUrl: schema.aiService.baseUrl, model: schema.aiService.model }).from(schema.aiService).where(eq(schema.aiService.id, id));
  if (!cur) throw new HttpError(404, "not_found");
  if (cur.provider !== input.provider) throw new HttpError(400, "provider_fixed");
  const baseUrl = input.provider === "openai_compatible" ? validateBaseUrl(input.baseUrl ?? "") : null;
  const retest = baseUrl !== cur.baseUrl || input.model !== cur.model;
  await db
    .update(schema.aiService)
    .set({ name: input.name, company: input.company, model: input.model, baseUrl, enabled: input.enabled, updatedBy: actorId, updatedAt: new Date(), ...(retest ? { lastTestOk: null, lastError: null } : {}) })
    .where(eq(schema.aiService.id, id));
}

/** Replaces the key. It must pass a test again. The caller has checked a fresh code. */
export async function replaceKey(db: Db, actorId: string, id: string, key: string, masterHex: string): Promise<{ provider: Provider; name: string; last4: string }> {
  const [cur] = await db.select({ provider: schema.aiService.provider, name: schema.aiService.name }).from(schema.aiService).where(eq(schema.aiService.id, id));
  if (!cur) throw new HttpError(404, "not_found");
  const box = await encryptKey(masterHex, key, id);
  const last4 = key.slice(-4);
  await db
    .update(schema.aiService)
    .set({ keyCiphertext: Buffer.from(box.ciphertext), keyIv: Buffer.from(box.iv), keyLast4: last4, lastTestOk: null, lastError: null, cooldownUntil: null, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(schema.aiService.id, id));
  return { ...cur, last4 };
}

const TESTS_PER_HOUR = 10;

/** At most 10 connection tests an hour per owner, so the button can't run up a provider bill. */
export async function takeTestSlot(db: Db, userId: string, now = Date.now()): Promise<boolean> {
  const key = `astro-ai-test:${userId}`;
  const windowStart = now - 3600_000;
  const [row] = await db
    .insert(schema.rateLimit)
    .values({ id: key, key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then 1 else ${schema.rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${schema.rateLimit.lastRequest} < ${windowStart} then ${now} else ${schema.rateLimit.lastRequest} end`
      }
    })
    .returning({ count: schema.rateLimit.count });
  return (row?.count ?? 0) <= TESTS_PER_HOUR;
}

/** Decrypts the key, sends one 5-token request, and records the result on the service. */
export async function runTest(db: Db, id: string, deps: { masterHex: string; gatewayUrl: string; fetchFn: typeof fetch }): Promise<{ ok: boolean; ms: number; error?: string; failure?: Failure }> {
  const [s] = await db.select().from(schema.aiService).where(eq(schema.aiService.id, id));
  if (!s) throw new HttpError(404, "not_found");
  if (!s.keyCiphertext || !s.keyIv) throw new HttpError(409, "no_key");
  const key = await decryptKey(deps.masterHex, { ciphertext: new Uint8Array(s.keyCiphertext), iv: new Uint8Array(s.keyIv) }, s.id);
  const r = await testService({ provider: s.provider, model: s.model, baseUrl: s.baseUrl, timeoutMs: s.timeoutMs }, key, deps.fetchFn, deps.gatewayUrl);
  await db
    .update(schema.aiService)
    .set({ lastTestAt: new Date(), lastTestOk: r.ok, lastError: r.ok ? null : `${r.failure}: ${r.error ?? ""}`.slice(0, 300), ...(r.ok ? { cooldownUntil: null } : {}) })
    .where(eq(schema.aiService.id, id));
  return r;
}

/** Replaces every role slot, if the new setup passes validateRoles. Returns its warnings. */
export async function saveRoles(db: Db, slots: Slot[]): Promise<{ ok: boolean; errors: string[]; warnings: string[] }> {
  const services: RoleService[] = await db.select({ id: schema.aiService.id, name: schema.aiService.name, company: schema.aiService.company, enabled: schema.aiService.enabled, lastTestOk: schema.aiService.lastTestOk, cooldownUntil: schema.aiService.cooldownUntil }).from(schema.aiService);
  const result = validateRoles(slots, services);
  if (!result.ok) return result;
  await db.transaction(async (tx) => {
    await tx.delete(schema.aiRoleSlot).where(sql`true`);
    await tx.insert(schema.aiRoleSlot).values(slots);
  });
  return result;
}

export type { AiRole };
export const ownerEmail = async (db: Db): Promise<string | null> =>
  (await db.select({ email: schema.user.email }).from(schema.staffRole).innerJoin(schema.user, eq(schema.user.id, schema.staffRole.userId)).where(and(eq(schema.staffRole.role, "owner"), sql`${schema.staffRole.revokedAt} is null`)))[0]?.email ?? null;
