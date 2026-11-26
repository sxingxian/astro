export type Role = "owner" | "admin" | "moderator" | "reader";

/** Roles that can sign in to the admin portal. Readers work in the app. */
export const PORTAL_ROLES: readonly Role[] = ["owner", "admin", "moderator"];

export const ACTIONS = [
  "dashboard.view",
  "text.edit",
  "text.publish",
  "meanings.view",
  "meanings.edit",
  "meanings.publish",
  "settings.edit",
  "ai.edit",
  "team.invite",
  "team.manage",
  "users.help",
  "audit.view",
  "requests.manage"
] as const;
export type Action = (typeof ACTIONS)[number];

// The access table in docs/spec/2026-11-26-admin-portal-design.md §2. The only place these rules live.
const ALLOWED: Record<Role, readonly Action[]> = {
  owner: ACTIONS,
  admin: ["dashboard.view", "text.edit", "text.publish", "meanings.view", "settings.edit", "team.invite", "team.manage", "users.help", "audit.view", "requests.manage"],
  moderator: ["dashboard.view", "users.help", "requests.manage"],
  reader: ["meanings.view"]
};

export function can(role: Role, action: Action): boolean {
  return ALLOWED[role].includes(action);
}

/** Who may give whom a role. Nobody can grant owner; there's always exactly one. */
export function canGrant(actor: Role, target: Role): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  if (actor === "admin") return target === "moderator" || target === "reader";
  return false;
}
