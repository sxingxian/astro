export const AI_ROLE_NAMES = ["writer", "checker_1", "checker_2"] as const;
export type AiRole = (typeof AI_ROLE_NAMES)[number];

/** Position 0 is the main service; 1 and up are fallbacks, tried in order. */
export interface Slot {
  role: AiRole;
  position: number;
  serviceId: string;
}

export interface RoleService {
  id: string;
  name: string;
  company: string;
  enabled: boolean;
  lastTestOk: boolean | null;
  cooldownUntil: Date | null;
}

const MIN_SLOTS = 3;
const MIN_COMPANIES = 3;
const company = (s: RoleService) => s.company.trim().toLowerCase();
const byPosition = (slots: Slot[], role: AiRole) => slots.filter((s) => s.role === role).sort((a, b) => a.position - b.position);

/**
 * Whether a role setup can run. Error codes: too_few:<role>, duplicate:<role>, not_ready:<serviceId>,
 * unknown:<serviceId>, too_few_companies. Warning: "fragile" with exactly 3 companies, because one outage then
 * leaves too few different companies for a reading.
 */
export function validateRoles(slots: Slot[], services: RoleService[]): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const byId = new Map(services.map((s) => [s.id, s]));
  for (const role of AI_ROLE_NAMES) {
    const ids = byPosition(slots, role).map((s) => s.serviceId);
    if (ids.length < MIN_SLOTS) errors.push(`too_few:${role}`);
    if (new Set(ids).size !== ids.length) errors.push(`duplicate:${role}`);
  }
  const used = [...new Set(slots.map((s) => s.serviceId))];
  for (const id of used) {
    const s = byId.get(id);
    if (!s) errors.push(`unknown:${id}`);
    else if (!s.enabled || s.lastTestOk !== true) errors.push(`not_ready:${id}`);
  }
  const companies = new Set(used.map((id) => byId.get(id)).filter((s): s is RoleService => Boolean(s)).map(company));
  if (companies.size < MIN_COMPANIES) errors.push("too_few_companies");
  return { ok: errors.length === 0, errors, warnings: errors.length === 0 && companies.size === MIN_COMPANIES ? ["fragile"] : [] };
}

/**
 * The services one reading uses: for the writer, then checker 1, then checker 2, the first slot whose service is
 * on, not cooling down, and from a company not already chosen. Null if any role runs out.
 */
export function pickServices(slots: Slot[], services: RoleService[], now: Date): Record<AiRole, string> | null {
  const byId = new Map(services.map((s) => [s.id, s]));
  const taken = new Set<string>();
  const picked = {} as Record<AiRole, string>;
  for (const role of AI_ROLE_NAMES) {
    const choice = byPosition(slots, role)
      .map((slot) => byId.get(slot.serviceId))
      .find((s): s is RoleService => Boolean(s && s.enabled && !(s.cooldownUntil && s.cooldownUntil > now) && !taken.has(company(s))));
    if (!choice) return null;
    taken.add(company(choice));
    picked[role] = choice.id;
  }
  return picked;
}
