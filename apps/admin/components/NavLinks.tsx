"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="nav flex flex-col gap-0.5" aria-label="Admin">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={(i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
