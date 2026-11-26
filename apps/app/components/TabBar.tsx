const tabs = [
  { href: "/today", label: "Today", icon: <><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></> },
  { href: "/journal", label: "Journal", icon: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5 17a3 3 0 0 1 3-3h11" fill="none" stroke="currentColor" strokeWidth="1.6" /></> },
  { href: "https://astro.midnightpoetry.studio/#deeper", label: "Go deeper", icon: <path d="M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /> },
  { href: "/account", label: "Account", icon: <><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" /></> }
];

/** The app's bottom navigation (mockups 2, 7, 8). */
export function TabBar({ current }: { current: "/today" | "/journal" | "/account" }) {
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-[#0F0F1E] pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto m-0 flex max-w-[560px] list-none p-0">
        {tabs.map((t) => (
          <li key={t.href} className="flex-1">
            <a href={t.href} aria-current={t.href === current ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] no-underline ${t.href === current ? "text-gold" : "text-muted"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
