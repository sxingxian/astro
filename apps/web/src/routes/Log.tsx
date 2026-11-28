import { getCard } from "@astro/cards";
import { useSearchParams } from "react-router";
import type { Entry } from "@/lib/reader-log";
import { ApiError } from "../api";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle, type T } from "../session";

type Item = Pick<Entry, "id" | "readOn" | "place" | "name" | "spread" | "cards">;

export const logDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pick = (t: T, c: { id: string; reversed: boolean }) => `${getCard(c.id).name}${c.reversed ? ` (${t("app.log.reversed")})` : ""}`;
const cardsOf = (t: T, e: Item) => e.cards.positions.map((p) => [pick(t, p.card), p.clarifier ? pick(t, p.clarifier) : null].filter(Boolean).join(" + ")).join(" · ");
const SPREAD = { one: "app.log.spread_one", three_any: "app.log.spread_three_any", three_pairs: "app.log.spread_three_pairs" } as const;

export const Lock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-none"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
);

/** My log: the reader's own outside readings, newest first (mockup D4: one action in the header, a table on desktop). */
export default function LogPage() {
  const { t } = useSession();
  useTitle(t("app.log.meta"));
  const after = useSearchParams()[0].get("after");
  const { data, error } = useData<{ items: Item[]; nextCursor: string | null }>(`/api/reader/log${after ? `?after=${encodeURIComponent(after)}` : ""}`);
  if (error) return <Failed error={error.status === 403 ? new ApiError(404, "not_found") : error} />;
  if (!data) return <Loading />;
  const { items, nextCursor } = data;

  return (
    <div data-page className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{t("app.desk.eyebrow")}</p>
          <h1 className="m-0 font-display text-4xl font-medium leading-tight lg:text-5xl">{t("app.log.title")}</h1>
          <p className="m-0 flex items-center gap-2 text-sm text-haze"><Lock />{t("app.log.private")}</p>
        </div>
        <div className="actions">
          <a className="btn-gold" href="/desk/log/new">{t("app.log.record")}</a>
        </div>
      </header>

      {items.length === 0 && !after ? (
        <p className="m-0 text-haze">{t("app.log.empty")}</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
            {items.map((e) => (
              <li key={e.id}>
                <a href={`/desk/log/${e.id}`} className="panel flex flex-col gap-1.5 p-4 text-moon no-underline">
                  <span className="text-xs text-muted">{logDay(e.readOn)} · {t(`app.log.place_${e.place}`)}</span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="font-display text-[17px] leading-snug text-haze">{cardsOf(t, e)}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="panel hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="border-b border-gold/15 px-4 py-3 font-semibold">{t("app.log.date")}</th>
                  <th scope="col" className="border-b border-gold/15 px-4 py-3 font-semibold">{t("app.log.name")}</th>
                  <th scope="col" className="border-b border-gold/15 px-4 py-3 font-semibold">{t("app.log.spread")}</th>
                  <th scope="col" className="border-b border-gold/15 px-4 py-3 font-semibold">{t("app.log.cards")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b border-gold/8 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3.5">{logDay(e.readOn)}</td>
                    <td className="px-4 py-3.5"><a href={`/desk/log/${e.id}`} className="font-semibold">{e.name}</a></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-haze">{t(SPREAD[e.spread])}</td>
                    <td className="px-4 py-3.5 text-haze">{cardsOf(t, e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? (
            <div className="actions">
              <a className="btn-ghost" href={`/desk/log?after=${encodeURIComponent(nextCursor)}`}>{t("app.log.more")}</a>
            </div>
          ) : null}
          <a href="/api/reader/log/export" download className="flex min-h-11 items-center self-start text-sm">{t("app.log.export")}</a>
        </>
      )}
    </div>
  );
}
