import { useSearchParams } from "react-router";
import type { JournalFilter, JournalItem } from "@/lib/journal";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { JournalSwitch } from "../shell/JournalSwitch";

// Ported from apps/app/app/journal/page.tsx (same markup); data from GET /api/journal.
const FILTERS = [
  { key: "all", label: "app.journal.filter_all" },
  { key: "one", label: "app.journal.one" },
  { key: "three", label: "app.journal.three" }
] as const satisfies readonly { key: JournalFilter; label: string }[];

export default function JournalPage() {
  const { t } = useSession();
  useTitle(t("app.journal.meta"));
  const [sp] = useSearchParams();
  const f = sp.get("filter");
  const filter: JournalFilter = f === "one" || f === "three" ? f : "all";
  const cursor = sp.get("cursor");
  const { data, error } = useData<{ items: JournalItem[]; nextCursor: string | null }>(`/api/journal?${new URLSearchParams({ filter, ...(cursor ? { cursor } : {}) })}`);
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  const { items, nextCursor } = data;

  return (
    <div data-page className="flex flex-col gap-5">
      <h1 className="m-0 font-display text-4xl font-medium">{t("app.journal.title")}</h1>
      <JournalSwitch current="readings" />
      <nav aria-label={t("app.journal.filter_label")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <a key={f.key} href={f.key === "all" ? "/journal" : `/journal?filter=${f.key}`} aria-current={f.key === filter ? "page" : undefined} className={`flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${f.key === filter ? "border-gold bg-gold font-semibold text-night" : "border-gold/30 text-haze"}`}>{t(f.label)}</a>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="m-0 text-haze">{t("app.journal.empty_before")} <a href="/today">{t("app.journal.empty_link")}</a> {t("app.journal.empty_after")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:grid lg:grid-cols-2 lg:gap-4">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`/reading/${it.id}`} className="panel flex items-center gap-3.5 p-3.5 text-moon no-underline">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs text-muted">{new Date(`${it.localDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · {it.spread === "one" ? t("app.journal.one") : t("app.journal.three")}{it.private ? t("app.journal.private_suffix") : ""}</span>
                  <span className="truncate font-display text-xl leading-tight">{it.cardNames.join(" · ")}</span>
                  <span className="truncate text-xs text-muted">{it.note ? t("app.journal.note_prefix", { note: it.note }) : t("app.journal.no_note")}</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#8C88A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </li>
          ))}
        </ul>
      )}
      {nextCursor ? <a className="btn-ghost" href={`/journal?${new URLSearchParams({ ...(filter === "all" ? {} : { filter }), cursor: nextCursor })}`}>{t("app.journal.older")}</a> : null}
    </div>
  );
}
