import { getCard } from "@astro/cards";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { CardFace } from "@astro/ui";
import type { PatternRange, Patterns } from "@astro/app-core/patterns";
import { ELEMENT_KEY, patternsCopy, SUIT_KEY } from "@/lib/patterns-copy";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { JournalSwitch } from "../shell/JournalSwitch";

// Ported from apps/app/app/journal/patterns/page.tsx (same markup); data from GET /api/patterns.
const RANGES = [
  { key: "30d", label: "app.patterns.range_30" },
  { key: "90d", label: "app.patterns.range_90" },
  { key: "all", label: "app.patterns.range_all_label" }
] as const satisfies readonly { key: PatternRange; label: string }[];

function Panel({ eyebrow, title, children }: { eyebrow: string; title?: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col gap-3.5 p-5">
      <p className="eyebrow">{eyebrow}</p>
      {title ? <h2 className="m-0 font-display text-2xl font-medium leading-tight">{title}</h2> : null}
      {children}
    </section>
  );
}

export default function PatternsPage() {
  const { t } = useSession();
  useTitle(t("app.patterns.meta"));
  const r = useSearchParams()[0].get("range");
  const range: PatternRange = r === "90d" || r === "all" ? r : "30d";
  const { data: p, error } = useData<Patterns>(`/api/patterns?range=${range}`);
  if (error) return <Failed error={error} />;
  if (!p) return <Loading />;
  const copy = patternsCopy(p, range, t);
  const early = p.readings < 3; // one "not yet" message instead of one per panel
  const maxSuit = Math.max(1, ...p.elements.map((e) => e.count));
  const outcomes = [
    { label: t("app.check_in.fit"), count: p.outcomes.fit },
    { label: t("app.check_in.partly"), count: p.outcomes.partly },
    { label: t("app.check_in.not"), count: p.outcomes.not }
  ];

  return (
    <div data-page className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h1 className="m-0 font-display text-4xl font-medium">{t("app.journal.title")}</h1>
        <span className="text-sm text-muted">{t(p.readings === 1 ? "app.patterns.count_one" : "app.patterns.count_many", { n: String(p.readings) })}</span>
      </div>
      <JournalSwitch current="patterns" />
      <nav aria-label={t("app.patterns.range_label")} className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <a key={r.key} href={r.key === "30d" ? "/journal/patterns" : `/journal/patterns?range=${r.key}`} aria-current={r.key === range ? "page" : undefined} className="chip">{t(r.label)}</a>
        ))}
      </nav>

      {early ? (
        <p className="m-0 rounded-xl bg-gold/8 px-4 py-3 text-sm leading-relaxed text-moon">
          <span className="font-semibold">{t("app.patterns.waiting")}.</span> {t("app.patterns.waiting_repeats")}
        </p>
      ) : null}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2">
      <Panel eyebrow={t("app.patterns.returning")} title={early ? undefined : copy.repeatsTitle}>
        {p.repeats.length ? (
          <ul className="m-0 flex list-none gap-3 p-0">
            {p.repeats.map((r) => (
              <li key={r.cardId} className="flex flex-1 flex-col items-center gap-2">
                <CardFace id={r.cardId} size="sm" />
                <span className="text-xs text-muted">{r.count === 2 ? t("app.patterns.shown_twice") : t("app.patterns.shown_n", { n: String(r.count) })}<span className="sr-only"> · {getCard(r.cardId).name}</span></span>
              </li>
            ))}
          </ul>
        ) : null}
        {early ? null : <p className="m-0 text-sm leading-relaxed text-haze">{copy.repeatsLine}</p>}
      </Panel>

      <Panel eyebrow={t("app.patterns.elements")} title={early ? undefined : copy.elementsTitle}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {p.elements.map((e) => (
            <li key={e.suit} className="flex flex-col gap-1.5 text-sm">
              <span className="flex justify-between gap-3">
                <span>{t(ELEMENT_KEY[e.suit])} <span className="text-muted">· {t(SUIT_KEY[e.suit])}</span></span>
                <span className="text-haze">{e.count}</span>
              </span>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-nebula"><span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((100 * e.count) / maxSuit)}%` }} /></span>
            </li>
          ))}
        </ul>
        {early ? null : <p className="m-0 text-sm leading-relaxed text-haze">{copy.elementsLine}</p>}
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel eyebrow={t("app.patterns.majors")}>
          <p className="m-0 font-display text-4xl leading-none">{p.majorShare}%</p>
          <p className="m-0 text-sm leading-snug text-haze">{copy.majorsLine}</p>
        </Panel>
        <Panel eyebrow={t("app.patterns.reversed")}>
          <p className="m-0 font-display text-4xl leading-none">{p.reversed.count} <span className="text-xl text-muted">{t("app.patterns.of", { n: String(p.reversed.of) })}</span></p>
          <p className="m-0 text-sm leading-snug text-haze">{copy.reversedLine}</p>
        </Panel>
      </div>

      <Panel eyebrow={t("app.patterns.outcomes")} title={t("app.patterns.outcomes_title")}>
        <ul className="m-0 flex list-none gap-2 p-0">
          {outcomes.map((o) => (
            <li key={o.label} className="flex flex-1 flex-col gap-1 rounded-2xl border border-gold/20 px-2 py-3 text-center">
              <span className="font-display text-3xl leading-none">{o.count}</span>
              <span className="text-xs text-haze">{o.label}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm leading-relaxed text-haze">
          {p.checkedIn.eligible === 0
            ? t("app.patterns.checked_in_none")
            : t(p.checkedIn.eligible === 1 ? "app.patterns.checked_in_one" : "app.patterns.checked_in", { done: String(p.checkedIn.done), eligible: String(p.checkedIn.eligible) })}
        </p>
      </Panel>
      </div>

      <p className="m-0 text-xs leading-relaxed text-muted">{t("app.patterns.footer")}</p>
    </div>
  );
}
