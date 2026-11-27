"use client";

import { allCards, type Suit } from "@astro/cards";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../CopyProvider";

export type CardPick = { id: string; reversed: boolean };
type Tab = "major" | Suit;
const TABS: Tab[] = ["major", "wands", "cups", "swords", "pentacles"];

/**
 * "Which card did you draw?" (mockup "P4 · Card chooser"): search, suit tabs, upright or reversed. A native modal
 * dialog, so focus stays inside and Escape closes it. `only` limits the choice for Major-then-Minor spreads.
 */
export function CardChooser({ open, context, only, initial, taken, onChoose, onClose }: { open: boolean; context: string; only: "major" | "minor" | null; initial: CardPick | null; taken: ReadonlySet<string>; onChoose: (p: CardPick) => void; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const firstTab: Tab = only === "minor" ? "wands" : "major";
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>(firstTab);
  const [chosen, setChosen] = useState<string | null>(null);
  const [reversed, setReversed] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const start = initial ? allCards.find((c) => c.id === initial.id) : undefined;
      setQuery("");
      setChosen(initial?.id ?? null);
      setReversed(initial?.reversed ?? false);
      setTab(start ? (start.suit ?? "major") : firstTab);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, initial, firstTab]);

  const tabs = TABS.filter((s) => (only === "major" ? s === "major" : only === "minor" ? s !== "major" : true));
  const cards = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w && w !== "of" && w !== "the");
    return allCards.filter((c) => {
      if (only && c.arcana !== only) return false;
      if (words.length) return words.every((w) => c.name.toLowerCase().includes(w));
      return (c.suit ?? "major") === tab;
    });
  }, [query, tab, only]);

  return (
    <dialog ref={ref} aria-labelledby="cc-h" onClose={onClose} className="m-auto mb-0 w-full max-w-[560px] rounded-t-3xl border-t border-gold/30 bg-[#15142C] p-0 text-moon backdrop:bg-night/70 sm:mb-auto sm:rounded-3xl sm:border">
      <div className="flex max-h-[86vh] flex-col gap-3.5 px-5 pb-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">{context}</span>
            <h2 id="cc-h" className="m-0 font-display text-[26px] font-medium">{t("app.log.chooser_title")}</h2>
          </div>
          <button type="button" aria-label={t("app.log.close")} onClick={onClose} className="flex size-11 items-center justify-center rounded-xl text-haze">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <label className="sr-only" htmlFor="cc-search">{t("app.log.search")}</label>
        <input id="cc-search" className="input" type="search" autoComplete="off" placeholder={t("app.log.search_placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query ? null : (
          <div role="tablist" aria-label={t("app.log.suits")} className="flex flex-none gap-2 overflow-x-auto pb-0.5">
            {tabs.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className={`min-h-10 flex-none rounded-full border px-3.5 text-sm ${tab === s ? "border-gold bg-gold font-semibold text-night" : "border-gold/30 text-haze"}`}>
                {t(`app.log.suit_${s}`)}
              </button>
            ))}
          </div>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
          {cards.map((c) => {
            const used = taken.has(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={chosen === c.id} disabled={used} title={used ? t("app.log.taken") : undefined} onClick={() => setChosen(c.id)} className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-2.5 text-left text-sm disabled:opacity-40 ${chosen === c.id ? "border-gold bg-nebula" : "border-gold/20 bg-ink"}`}>
                <span aria-hidden="true" className="h-7 w-[18px] flex-none rounded-[3px] bg-moon" />
                {c.name}
              </button>
            );
          })}
          {cards.length === 0 ? <p className="col-span-2 m-0 text-sm text-muted">{t("app.log.no_match")}</p> : null}
        </div>
        <div role="radiogroup" aria-label={t("app.log.orientation")} className="flex flex-none gap-1 rounded-full border border-gold/20 bg-[#0F0F1E] p-1">
          {[false, true].map((r) => (
            <button key={String(r)} type="button" role="radio" aria-checked={reversed === r} onClick={() => setReversed(r)} className={`min-h-10 flex-1 rounded-full text-sm ${reversed === r ? "bg-gold font-semibold text-night" : "text-haze"}`}>
              {t(r ? "app.log.reversed_option" : "app.log.upright")}
            </button>
          ))}
        </div>
        <button type="button" className="btn-gold" disabled={!chosen} onClick={() => chosen && onChoose({ id: chosen, reversed })}>{t("app.log.use")}</button>
      </div>
    </dialog>
  );
}
