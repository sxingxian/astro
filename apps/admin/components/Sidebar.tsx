import Link from "next/link";
import { Brand } from "./Brand";

export interface NavItem {
  href: string;
  label: string;
}

/** The portal's side menu from the Plan 3 mockups. Items are filtered by role before they get here. */
export function Sidebar({ items, current, email, role }: { items: NavItem[]; current: string; email: string; role: string }) {
  return (
    <aside className="flex-[0_0_240px] box-border px-3.5 py-5 border-r border-gold/12 bg-deep flex flex-col gap-4.5">
      <div className="flex items-center gap-2 px-2 py-1">
        <Brand />
        <span className="text-[11px] text-muted ml-auto">Admin</span>
      </div>
      <nav className="nav flex flex-col gap-0.5" aria-label="Admin">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={i.href === current ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-3 rounded-xl border border-gold/14 text-xs text-muted leading-relaxed">
        Signed in as <span className="text-moon break-all">{email}</span>
        <br />
        <span className="capitalize">{role}</span> · 2-step on
      </div>
    </aside>
  );
}
