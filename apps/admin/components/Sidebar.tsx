import type { Role } from "@astro/server";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

/** The portal's side menu from the Plan 3 mockups. Items are already filtered by role. */
export function Sidebar({ items, email, role }: { items: { href: string; label: string }[]; email: string; role: Role }) {
  return (
    <aside className="flex-[0_0_240px] box-border px-3.5 py-5 border-r border-gold/12 bg-deep flex flex-col gap-4.5">
      <div className="flex items-center gap-2 px-2 py-1">
        <Brand />
        <span className="text-[11px] text-muted ml-auto">Admin</span>
      </div>
      <NavLinks items={items} />
      <div className="mt-auto flex flex-col gap-3">
        <div className="p-3 rounded-xl border border-gold/14 text-xs text-muted leading-relaxed">
          Signed in as <span className="text-moon break-all">{email}</span>
          <br />
          <span className="capitalize">{role}</span> · 2-step on
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
