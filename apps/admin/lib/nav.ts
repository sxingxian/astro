import { can, type Action, type Role } from "@astro/server";

const NAV: { href: string; label: string; action: Action }[] = [
  { href: "/", label: "Dashboard", action: "dashboard.view" },
  { href: "/ai", label: "AI settings", action: "ai.edit" },
  { href: "/settings", label: "Site settings", action: "settings.edit" },
  { href: "/users", label: "Users", action: "users.help" },
  { href: "/team", label: "Team and roles", action: "team.invite" },
  { href: "/audit", label: "Audit log", action: "audit.view" }
];

/** The menu for a role: only the screens it may open. */
export const navFor = (role: Role) => NAV.filter((n) => can(role, n.action)).map(({ href, label }) => ({ href, label }));
