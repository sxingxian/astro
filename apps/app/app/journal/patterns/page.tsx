import { getCard } from "@astro/cards";
import { CardFace } from "@astro/ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JournalSwitch } from "@/components/journal/JournalSwitch";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { computePatterns, type PatternRange } from "@/lib/patterns";
import { ELEMENT_KEY, patternsCopy, SUIT_KEY } from "@/lib/patterns-copy";
import { getCopy } from "@/lib/copy";

export async function generateMetadata() {
  return { title: (await getCopy())("app.patterns.meta") };
}

const RANGES = [
  { key: "30d", label: "app.patterns.range_30" },
  { key: "90d", label: "app.patterns.range_90" },
  { key: "all", label: "app.patterns.range_all_label" }
] as const satisfies readonly { key: PatternRange; label: string }[];

function Panel({ eyebrow, title, children }: { eyebrow: string; title?: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-3.5 p-5">
      <p className="eyebrow">{eyebrow}</p>
      {title ? <h2 className="m-0 font-display text-2xl font-medium leading-tight">{title}</h2> : null}
      {children}
    </section>
  );
}

export default async function PatternsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const sp = await searchParams;
  const range: PatternRange = sp.range === "90d" || sp.range === "all" ? sp.range : "30d";
  const p = await computePatterns(getDb(), user.id, range);
  const t = await getCopy();
  const copy = patternsCopy(p, range, t);
  const maxSuit = Math.max(1, ...p.elements.map((e) => e.count));
  const outcomes = [
    { label: t("app.check_in.fit"), count: p.outcomes.fit },
    { label: t("app.check_in.partly"), count: p.outcomes.partly },
    { label: t("app.check_in.not"), count: p.outcomes.not }
  ];

  return (
    <AppShell current="patterns">
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-8">
      <div className="flex items-baseline justify-between">
        <h1 className="m-0 font-display text-4xl font-medium">{t("app.journal.title")}</h1>
        <span className="text-sm text-muted">{t(p.readings === 1 ? "app.patterns.count_one" : "app.patterns.count_many", { n: String(p.readings) })}</span>
      </div>
      <JournalSwitch current="patterns" />
      <nav aria-label={t("app.patterns.range_label")} className="flex gap-2">
        {RANGES.map((r) => (
          <a key={r.key} href={r.key === "30d" ? "/journal/patterns" : `/journal/patterns?range=${r.key}`} aria-current={r.key === range ? "page" : undefined} className={`flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${r.key === range ? "border-gold text-moon" : "border-gold/30 text-haze"}`}>{t(r.label)}</a>
        ))}
      </nav>

      <Panel eyebrow={t("app.patterns.returning")} title={copy.repeatsTitle}>
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
        <p className="m-0 text-sm leading-relaxed text-haze">{copy.repeatsLine}</p>
      </Panel>

      <Panel eyebrow={t("app.patterns.elements")} title={copy.elementsTitle}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {p.elements.map((e) => (
            <li key={e.suit} className="grid grid-cols-[96px_1fr_28px] items-center gap-2.5 text-sm">
              <span>{t(ELEMENT_KEY[e.suit])} <span className="text-muted">· {t(SUIT_KEY[e.suit])}</span></span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-nebula"><span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((100 * e.count) / maxSuit)}%` }} /></span>
              <span className="text-right text-haze">{e.count}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm leading-relaxed text-haze">{copy.elementsLine}</p>
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
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.patterns.checked_in", { done: String(p.checkedIn.done), eligible: String(p.checkedIn.eligible) })}</p>
      </Panel>

      <p className="m-0 text-xs leading-relaxed text-muted">{t("app.patterns.footer")}</p>
    </div>
    </AppShell>
  );
}
