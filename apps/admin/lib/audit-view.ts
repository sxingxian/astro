import { AUDIT_ACTIONS, type AuditFilter, type AuditRow } from "@astro/server";
import { AUDIT_GROUPS, type AuditGroup } from "./audit-groups";

export { AUDIT_GROUPS, type AuditGroup };

export const SETTING_LABEL: Record<string, string> = {
  reversal_rate: "Reversal rate",
  guest_daily_cap: "Guest draws per day",
  maintenance_mode: "Maintenance mode",
  contact_email: "Support email",
  social_links: "Social links",
  disclaimer_note: "Reading disclaimer",
  ai_daily_cap_usd: "AI daily spending limit",
  ai_per_person_per_day: "AI readings per person per day"
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export interface AuditQuery {
  actor?: string;
  group?: AuditGroup;
  from?: string;
  to?: string;
}

/** Reads the filters from the address bar, dropping anything malformed. Dates are whole UTC days. */
export function parseAuditQuery(params: Record<string, string | string[] | undefined>): { query: AuditQuery; filter: AuditFilter } {
  const actor = one(params.actor);
  const group = one(params.group);
  const from = one(params.from);
  const to = one(params.to);
  const cursor = Number(one(params.cursor));
  const query: AuditQuery = {
    actor: actor && actor.length <= 64 ? actor : undefined,
    group: group && group in AUDIT_GROUPS ? (group as AuditGroup) : undefined,
    from: from && DAY.test(from) ? from : undefined,
    to: to && DAY.test(to) ? to : undefined
  };
  const filter: AuditFilter = {
    actorId: query.actor,
    actions: query.group ? Object.keys(AUDIT_ACTIONS).filter((a) => AUDIT_GROUPS[query.group!].prefixes.some((p) => a.startsWith(p))) : undefined,
    from: query.from ? new Date(`${query.from}T00:00:00Z`) : undefined,
    to: query.to ? new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86_400_000) : undefined,
    cursor: Number.isSafeInteger(cursor) && cursor > 0 ? cursor : undefined
  };
  return { query, filter };
}

export function queryString(q: AuditQuery, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...q, ...extra })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", reader: "Reader" };
const role = (r: unknown) => ROLE[String(r)] ?? String(r ?? "");
const day = (iso: unknown) => new Date(String(iso)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "What" and "Details" for one entry, in plain words. Unknown actions fall back to their code. */
export function describe(e: Pick<AuditRow, "action" | "summary">): { what: string; details: string } {
  const s = e.summary;
  switch (e.action) {
    case "auth.sign_in":
      return { what: "Signed in", details: [s.method === "authenticator" ? "Authenticator code" : s.method === "backup code" ? "Backup code" : "Password", s.country].filter(Boolean).join(" · ") };
    case "team.invite":
      return { what: "Invited someone", details: `${role(s.role)} · ${s.email} · expires ${day(s.expiresAt)}` };
    case "team.revoke":
      return { what: "Cancelled an invite", details: `${role(s.role)} · ${s.email}` };
    case "team.role":
      return { what: "Changed a role", details: `${s.email} · ${role(s.from)} → ${role(s.to)}` };
    case "team.remove":
      return { what: "Removed from the team", details: `${s.email} · was ${role(s.role)}` };
    case "team.accept":
      return { what: "Joined the team", details: role(s.role) };
    case "user.find":
      return { what: "Looked up an account", details: `${s.email}${s.found ? "" : " · no match"}` };
    case "user.disable":
      return { what: "Disabled an account", details: String(s.email) };
    case "user.enable":
      return { what: "Enabled an account", details: String(s.email) };
    case "user.reset_2fa":
      return { what: "Reset 2-step sign-in", details: String(s.email) };
    case "settings.change":
      return { what: "Changed a setting", details: `${SETTING_LABEL[String(s.setting)] ?? s.setting} → ${s.value}` };
    case "audit.export":
      return { what: "Downloaded the audit log", details: `${s.rows} entries` };
    default:
      return { what: e.action, details: "" };
  }
}

export const who = (e: Pick<AuditRow, "actorId" | "actorEmail" | "actorRole">, meId: string) =>
  `${e.actorId === meId ? "You" : (e.actorEmail ?? "Deleted account")}${e.actorRole ? ` · ${role(e.actorRole)}` : ""}`;
