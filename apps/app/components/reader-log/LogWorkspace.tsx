import { getCard } from "@astro/cards";
import type { SessionUser } from "@/lib/auth";
import type { T } from "@astro/copy";
import { getDb } from "@/lib/db";
import { formValue } from "@/lib/log-form";
import { listEntries, type Entry } from "@/lib/reader-log";
import { AppShell } from "../AppShell";
import { LogForm } from "./LogForm";
import { formatDate } from "@astro/copy/dates";

const day = (iso: string) => formatDate(iso);
const pick = (t: T, c: { id: string; reversed: boolean }) => `${getCard(c.id).name}${c.reversed ? ` (${t("app.log.reversed")})` : ""}`;

/**
 * My log (mockups "Log list" and "Log record" on phones, D4 on desktop). Phones show one thing at a time: the list,
 * or the form. Desktop shows the list on the left and the record or edit form on the right.
 */
export async function LogWorkspace({ user, t, mode, entry, after }: { user: SessionUser; t: T; mode: "list" | "new" | "edit"; entry?: Entry; after?: string | null }) {
  const db = getDb();
  // A tampered "after" link just shows the first page.
  const { items, nextCursor } = await listEntries(db, user.id, { cursor: after && after.length <= 200 ? after : null }).catch(() => listEntries(db, user.id, {}));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timeZone || "UTC" });
  const formTitle = mode === "edit" ? t("app.log.edit_title") : t("app.log.new_title");
  const lock = <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-none"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;

  return (
    <AppShell current="desk" reader>
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-6 lg:max-w-none lg:px-0 lg:pb-16 lg:pt-4">
        <header className={`flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between ${mode === "list" ? "" : "max-lg:hidden"}`}>
          <div className="flex flex-col gap-2">
            <p className="eyebrow lg:hidden">{t("app.desk.eyebrow")}</p>
            <h1 className="m-0 font-display text-4xl font-medium leading-tight lg:text-5xl">{t("app.log.title")}</h1>
            <p className="m-0 flex items-center gap-2 text-sm text-haze">{lock}{t("app.log.private")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {items.length ? <a className="btn-ghost min-h-12 px-5" href="/api/reader/log/export" download>{t("app.log.export")}</a> : null}
            <a className="btn-gold min-h-12 flex-1 px-6 lg:flex-none" href="/desk/log/new">{t("app.log.record")}</a>
          </div>
        </header>

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <section aria-label={t("app.log.title")} className={`flex flex-col gap-2.5 lg:panel lg:p-3 ${mode === "list" ? "" : "max-lg:hidden"}`}>
            {items.length === 0 && !after ? <p className="m-0 p-2 text-sm text-muted">{t("app.log.empty")}</p> : null}
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-1">
              {items.map((e) => (
                <li key={e.id}>
                  <a
                    href={`/desk/log/${e.id}`}
                    aria-current={entry?.id === e.id ? "page" : undefined}
                    className={`flex flex-col gap-1.5 rounded-2xl p-4 text-moon no-underline max-lg:panel lg:border lg:p-3.5 ${entry?.id === e.id ? "lg:border-gold/60" : "lg:border-transparent"}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{e.name}</span>
                      <span className="flex-none text-xs text-muted">{day(e.readOn)} · {t(`app.log.place_${e.place}`)}</span>
                    </span>
                    <span className="font-display text-[17px] leading-snug text-haze">
                      {e.cards.positions.map((p) => [pick(t, p.card), p.clarifier ? pick(t, p.clarifier) : null].filter(Boolean).join(" + ")).join(" · ")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {nextCursor ? <a className="btn-ghost self-center" href={`/desk/log?after=${encodeURIComponent(nextCursor)}`}>{t("app.log.more")}</a> : null}
          </section>

          <section aria-labelledby="log-form-h" className={`flex flex-col gap-5 lg:panel lg:p-8 ${mode === "list" ? "max-lg:hidden" : ""}`}>
            <header className="flex items-center gap-2">
              <a href="/desk/log" aria-label={t("app.log.back")} className="-ml-2 flex size-11 items-center justify-center text-moon lg:hidden">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <h2 id="log-form-h" className="m-0 font-display text-3xl font-medium">{formTitle}</h2>
            </header>
            <p className="m-0 flex items-center gap-2 text-sm text-haze lg:hidden">{lock}{t("app.log.private")}</p>
            <LogForm key={entry?.id ?? "new"} initial={entry ? formValue(t, entry.readOn, entry) : formValue(t, today)} />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
