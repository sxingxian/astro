import { getCard } from "@astro/cards";
import { AppShell } from "@/components/AppShell";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { listEntries } from "@/lib/reader-log";
import { requireReaderPage } from "@/lib/reader-page";

export async function generateMetadata() {
  return { title: (await getCopy())("app.log.meta") };
}
export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** My log (mockup "P4 · Log list"): the reader's own outside readings, newest first. */
export default async function LogPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const user = await requireReaderPage();
  const [t, { after }] = await Promise.all([getCopy(), searchParams]);
  // A tampered "after" link just shows the first page.
  const db = getDb();
  const { items, nextCursor } = await listEntries(db, user.id, { cursor: after && after.length <= 200 ? after : null }).catch(() => listEntries(db, user.id, {}));
  return (
    <AppShell current="desk" reader>
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-8 lg:max-w-[880px] lg:pb-16">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">{t("app.desk.eyebrow")}</p>
          <h1 className="m-0 font-display text-4xl font-medium leading-tight">{t("app.log.title")}</h1>
          <p className="m-0 flex items-center gap-2 text-sm text-haze">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            {t("app.log.private")}
          </p>
        </header>
        <div className="flex flex-wrap gap-3">
          <a className="btn-gold flex-1" href="/desk/log/new">{t("app.log.record")}</a>
          {items.length ? <a className="btn-ghost" href="/api/reader/log/export" download>{t("app.log.export")}</a> : null}
        </div>
        {items.length === 0 && !after ? <p className="m-0 text-sm text-muted">{t("app.log.empty")}</p> : null}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:grid lg:grid-cols-2 lg:gap-4">
          {items.map((e) => (
            <li key={e.id}>
              <a href={`/desk/log/${e.id}`} className="panel flex flex-col gap-1.5 p-4 no-underline text-moon">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-xl">{e.name}</span>
                  <span className="text-xs text-muted">{day(e.readOn)}</span>
                </span>
                <span className="text-xs text-muted">{t(`app.log.place_${e.place}`)} · {t(`app.log.spread_${e.spread}`)}</span>
                <span className="truncate text-sm text-haze">
                  {e.cards.positions.map((p) => `${getCard(p.card.id).name}${p.card.reversed ? ` (${t("app.log.reversed")})` : ""}`).join(" · ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {nextCursor ? <a className="btn-ghost self-center" href={`/desk/log?after=${encodeURIComponent(nextCursor)}`}>{t("app.log.more")}</a> : null}
      </div>
    </AppShell>
  );
}
