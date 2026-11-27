import type { AppKey } from "@astro/copy";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { readerStatus } from "@/lib/readers";

export type ShellTab = "today" | "ask" | "journal" | "patterns" | "account" | "desk";

const ICONS: Record<ShellTab, ReactNode> = {
  today: <><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  ask: <><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 8l.7 1.8 1.8.7-1.8.7L12 13l-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor" /></>,
  journal: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5 17a3 3 0 0 1 3-3h11" fill="none" stroke="currentColor" strokeWidth="1.6" /></>,
  patterns: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  account: <><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" /></>,
  desk: <><rect x="3" y="7" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 7V5h8v2" fill="none" stroke="currentColor" strokeWidth="1.6" /></>
};

const ITEMS: { tab: ShellTab; href: string; label: AppKey }[] = [
  { tab: "today", href: "/today", label: "app.tabs.today" },
  { tab: "ask", href: "/ask", label: "app.tabs.ask" },
  { tab: "journal", href: "/journal", label: "app.tabs.journal" },
  { tab: "patterns", href: "/journal/patterns", label: "app.nav.patterns" },
  { tab: "account", href: "/account", label: "app.tabs.account" }
];

/**
 * Every signed-in-style screen: a side menu on desktop (≥ 1024 px), bottom tabs on phones (mockups D1–D4).
 * Patterns lives inside Journal on phones, so the phone tabs leave it out; readers get Desk. Whether the signed-in
 * person is a reader is looked up here unless the page already knows.
 */
export async function AppShell({ current, reader, children }: { current?: ShellTab; reader?: boolean; children: ReactNode }) {
  const [t, user] = await Promise.all([getCopy(), getSessionUser(await headers())]);
  if (reader === undefined) reader = user ? (await readerStatus(getDb(), user.id)).reader : false;
  const phoneTabs = ITEMS.filter((i) => i.tab !== "patterns");
  const phoneCurrent = current === "patterns" ? "journal" : current;
  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[248px] lg:flex-none lg:flex-col lg:gap-6 lg:border-r lg:border-gold/12 lg:bg-[#0F0F1E] lg:px-4 lg:py-6">
        <a href="/today" className="flex items-center gap-2 px-3 py-1 text-moon no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          <span className="font-display text-2xl font-semibold">Astro</span>
        </a>
        <nav aria-label={t("app.nav.label")} className="flex flex-col gap-1">
          {ITEMS.map((i) => (
            <a key={i.tab} href={i.href} aria-current={i.tab === current ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline ${i.tab === current ? "bg-nebula font-semibold text-moon" : "text-haze"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">{ICONS[i.tab]}</svg>
              {t(i.label)}
            </a>
          ))}
          {reader ? (
            <>
              <span className="mt-4 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t("app.nav.reader")}</span>
              <a href="/desk" aria-current={current === "desk" ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline ${current === "desk" ? "bg-nebula font-semibold text-moon" : "text-haze"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">{ICONS.desk}</svg>
                {t("app.nav.my_log")}
              </a>
            </>
          ) : null}
        </nav>
        {user ? (
          <a href="/account" className="mt-auto flex flex-col gap-0.5 rounded-xl border border-gold/14 p-3 text-xs text-muted no-underline">
            <span className="truncate text-sm text-moon">{user.email}</span>
            <span>{reader ? t("app.nav.account_reader") : t("app.nav.account_free")} · {user.twoFactorEnabled ? t("app.nav.two_step_on") : t("app.nav.two_step_off")}</span>
          </a>
        ) : (
          <a href="/sign-up" className="btn-ghost mt-auto min-h-11 text-sm">{t("app.today.sign_up")}</a>
        )}
      </aside>
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-[1100px] lg:px-12 lg:pb-16 lg:pt-6">{children}</div>
      </div>
      <nav aria-label={t("app.tabs.label")} className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-[#0F0F1E] pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto m-0 flex max-w-[560px] list-none p-0">
          {[...phoneTabs, ...(reader ? [{ tab: "desk" as const, href: "/desk", label: "app.tabs.desk" as const }] : [])].map((i) => (
            <li key={i.tab} className="flex-1">
              <a href={i.href} aria-current={i.tab === phoneCurrent ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] no-underline ${i.tab === phoneCurrent ? "text-gold" : "text-muted"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">{ICONS[i.tab]}</svg>
                {t(i.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
