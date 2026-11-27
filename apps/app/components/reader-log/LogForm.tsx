"use client";

import { getCard } from "@astro/cards";
import { useState } from "react";
import { FormError } from "../AuthShell";
import { useT } from "../CopyProvider";
import { CardChooser, type CardPick } from "./CardChooser";
import { postJson } from "@/lib/client";

type Pick = CardPick | null;
interface Position { label: string; card: Pick; clarifier: Pick }
interface Extra { card: Pick; attachedTo: number | null }
export interface LogFormValue {
  id?: string;
  readOn: string;
  place: "in_person" | "online" | "event";
  name: string;
  question: string;
  notes: string;
  consent: boolean;
  spread: "one" | "three_any" | "three_pairs";
  positions: Position[];
  extras: Extra[];
}
type Target = { kind: "card" | "clarifier" | "extra"; index: number };

const PLACES = ["in_person", "online", "event"] as const;

/** Recording or editing one outside reading (mockup "P4 · Log record"). */
export function LogForm({ initial }: { initial: LogFormValue }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const three = v.spread !== "one";
  const pairs = v.spread === "three_pairs";
  const defaults = [t("app.log.pos_past"), t("app.log.pos_present"), t("app.log.pos_future")];

  const set = (patch: Partial<LogFormValue>) => setV((cur) => ({ ...cur, ...patch }));
  function setSpread(spread: LogFormValue["spread"]) {
    const n = spread === "one" ? 1 : 3;
    const positions = Array.from({ length: n }, (_, i): Position => {
      const old = v.positions[i];
      // Keep names the reader typed while the number of positions stays the same; otherwise use the defaults.
      const label = v.positions.length === n && old ? old.label : n === 1 ? t("app.log.pos_card") : defaults[i]!;
      const keep = (c: Pick, arcana: "major" | "minor") => (c && (spread !== "three_pairs" || getCard(c.id).arcana === arcana) ? c : null);
      return { label, card: keep(old?.card ?? null, "major"), clarifier: spread === "three_pairs" ? keep(old?.clarifier ?? null, "minor") : null };
    });
    set({ spread, positions, extras: v.extras.map((e) => ({ ...e, attachedTo: e.attachedTo !== null && e.attachedTo < n ? e.attachedTo : null })) });
  }

  const current = (x: Target | null): Pick => (!x ? null : x.kind === "extra" ? v.extras[x.index]?.card ?? null : v.positions[x.index]?.[x.kind] ?? null);
  // Cards already in this reading, except the one being changed: a deck holds each card once.
  const taken = new Set([...v.positions.flatMap((p) => [p.card, p.clarifier]), ...v.extras.map((e) => e.card)].filter((c): c is CardPick => Boolean(c) && c!.id !== current(target)?.id).map((c) => c.id));

  function choose(p: CardPick) {
    if (!target) return;
    if (target.kind === "extra") set({ extras: v.extras.map((e, i) => (i === target.index ? { ...e, card: p } : e)) });
    else set({ positions: v.positions.map((pos, i) => (i === target.index ? { ...pos, [target.kind]: p } : pos)) });
    setTarget(null);
  }

  const cardText = (c: Pick) => (c ? `${getCard(c.id).name}${c.reversed ? ` · ${t("app.log.reversed")}` : ""}` : t("app.log.choose"));
  const contextFor = (x: Target | null) => {
    if (!x) return "";
    if (x.kind === "extra") return t("app.log.extras");
    const label = v.positions[x.index]?.label ?? "";
    return `${label} · ${x.kind === "clarifier" ? t("app.log.slot_minor") : pairs ? t("app.log.slot_major") : t("app.log.slot_card")}`;
  };

  function slot(x: Target, kind: string) {
    const c = current(x);
    return (
      <button key={`${x.kind}-${x.index}`} type="button" onClick={() => setTarget(x)} aria-label={`${contextFor(x)}: ${cardText(c)}`} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-gold/25 bg-ink px-2.5 py-1.5 text-left text-sm">
        <span aria-hidden="true" className={`h-[38px] w-6 flex-none rounded border border-gold ${c ? "bg-moon" : "bg-transparent"} ${c?.reversed ? "rotate-180" : ""}`} />
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted">{kind}</span>
          <span className={`truncate ${c ? "" : "text-gold"}`}>{cardText(c)}</span>
        </span>
      </button>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (v.positions.some((p) => !p.card || (pairs && !p.clarifier)) || v.extras.some((x) => !x.card) || !v.consent) return setError(t("app.log.invalid"));
    setBusy(true);
    setError(null);
    const body = {
      readOn: v.readOn,
      place: v.place,
      name: v.name,
      question: v.question,
      notes: v.notes,
      consent: v.consent,
      spread: v.spread,
      cards: { positions: v.positions.map((p) => ({ label: p.label, card: p.card, ...(pairs ? { clarifier: p.clarifier } : {}) })), extras: v.extras }
    };
    const res = v.id ? await postJson(`/api/reader/log/${v.id}`, body, {}, "PUT") : await postJson("/api/reader/log", body);
    setBusy(false);
    if (res.ok) return window.location.assign("/desk/log");
    setError(t(res.status === 400 ? "app.log.invalid" : "app.common.went_wrong"));
  }

  async function remove() {
    setBusy(true);
    const res = await postJson(`/api/reader/log/${v.id}`, {}, {}, "DELETE");
    setBusy(false);
    if (res.ok) return window.location.assign("/desk/log");
    setError(t("app.common.went_wrong"));
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-[18px]" noValidate>
      <div className="flex flex-col gap-[18px] lg:grid lg:grid-cols-3 lg:gap-4">
      <div className="field">
        <label htmlFor="log-name">{t("app.log.name")}</label>
        <input id="log-name" className="input" value={v.name} maxLength={60} required autoComplete="off" onChange={(e) => set({ name: e.target.value })} aria-describedby="log-name-hint" />
        <span id="log-name-hint" className="text-xs text-muted">{t("app.log.name_hint")}</span>
      </div>
      <div className="flex gap-3 lg:contents">
        <div className="field flex-1"><label htmlFor="log-date">{t("app.log.date")}</label><input id="log-date" className="input" type="date" required value={v.readOn} onChange={(e) => set({ readOn: e.target.value })} /></div>
        <div className="field flex-1">
          <label htmlFor="log-where">{t("app.log.where")}</label>
          <select id="log-where" className="input" value={v.place} onChange={(e) => set({ place: e.target.value as LogFormValue["place"] })}>
            {PLACES.map((p) => <option key={p} value={p}>{t(`app.log.place_${p}`)}</option>)}
          </select>
        </div>
      </div>
      </div>
      <div className="field">
        <label htmlFor="log-question">{t("app.log.question")}</label>
        <textarea id="log-question" className="input min-h-[72px] py-2.5" rows={2} maxLength={280} value={v.question} onChange={(e) => set({ question: e.target.value })} />
      </div>

      <div className="flex flex-col gap-[18px] lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
      <div className="flex flex-col gap-2">
        <span id="log-spread" className="text-sm text-haze">{t("app.log.spread")}</span>
        <div role="radiogroup" aria-labelledby="log-spread" className="flex gap-1 rounded-full border border-gold/20 bg-ink p-1">
          {([["one", t("app.log.spread_one")], ["three", t("app.log.spread_three")]] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={k === "one" ? !three : three} onClick={() => setSpread(k === "one" ? "one" : pairs ? "three_pairs" : "three_any")} className={`min-h-10 flex-1 rounded-full text-sm ${(k === "one" ? !three : three) ? "bg-gold font-semibold text-night" : "text-haze"}`}>{label}</button>
          ))}
        </div>
      </div>
      {three ? (
        <div className="flex flex-col gap-2">
          <span id="log-layout" className="text-sm text-haze">{t("app.log.layout")}</span>
          <div role="radiogroup" aria-labelledby="log-layout" className="flex gap-2.5">
            {([["three_any", "app.log.layout_any", "app.log.layout_any_hint"], ["three_pairs", "app.log.layout_pairs", "app.log.layout_pairs_hint"]] as const).map(([k, label, hint]) => (
              <button key={k} type="button" role="radio" aria-checked={v.spread === k} onClick={() => setSpread(k)} className={`flex flex-1 flex-col gap-1 rounded-2xl border bg-ink p-3 text-left ${v.spread === k ? "border-gold shadow-[inset_0_0_0_1px_var(--color-gold)]" : "border-gold/25"}`}>
                <span className="text-sm font-semibold">{t(label)}</span>
                <span className="text-xs text-haze">{t(hint)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      </div>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2.5 p-0 text-sm text-haze">{t("app.log.cards")}</legend>
        <div className={`flex flex-col gap-2.5 ${three ? "lg:grid lg:grid-cols-3" : ""}`}>
        {v.positions.map((p, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border border-gold/15 p-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              {t("app.log.position_name")}
              <input className="input min-h-9 flex-1 px-2.5 text-sm" value={p.label} maxLength={30} onChange={(e) => set({ positions: v.positions.map((q, j) => (j === i ? { ...q, label: e.target.value } : q)) })} />
            </label>
            <div className="flex gap-2">
              {slot({ kind: "card", index: i }, pairs ? t("app.log.slot_major") : t("app.log.slot_card"))}
              {pairs ? slot({ kind: "clarifier", index: i }, t("app.log.slot_minor")) : null}
            </div>
          </div>
        ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2.5">
        <span className="text-sm text-haze">{t("app.log.extras")}</span>
        {v.extras.map((x, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border border-gold/15 p-3">
            <div className="flex items-center gap-2">
              {slot({ kind: "extra", index: i }, t("app.log.extras"))}
              <button type="button" aria-label={t("app.log.remove_extra")} onClick={() => set({ extras: v.extras.filter((_, j) => j !== i) })} className="flex size-11 flex-none items-center justify-center rounded-xl text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              {t("app.log.extra_with")}
              <select className="input min-h-9 flex-1 text-sm" value={x.attachedTo === null ? "" : String(x.attachedTo)} onChange={(e) => set({ extras: v.extras.map((y, j) => (j === i ? { ...y, attachedTo: e.target.value === "" ? null : Number(e.target.value) } : y)) })}>
                <option value="">{t("app.log.extra_whole")}</option>
                {v.positions.map((p, j) => <option key={j} value={j}>{p.label}</option>)}
              </select>
            </label>
          </div>
        ))}
        {v.extras.length < 6 ? (
          <button type="button" onClick={() => set({ extras: [...v.extras, { card: null, attachedTo: null }] })} className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-dashed border-gold/45 text-sm font-semibold text-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            {t("app.log.add_extra")}
          </button>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="log-notes">{t("app.log.notes")}</label>
        <textarea id="log-notes" className="input min-h-[110px] py-2.5" rows={4} maxLength={4000} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <label className="flex items-start gap-3 text-sm leading-snug text-haze">
        <input type="checkbox" checked={v.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-px size-5 flex-none accent-gold" />
        {t("app.log.consent")}
      </label>
      <FormError message={error} />
      <button type="submit" className="btn-gold" disabled={busy}>{busy ? t("app.log.saving") : t("app.log.save")}</button>
      {v.id ? (
        confirmDelete ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-haze">{t("app.log.delete_warning")}</p>
            <div className="flex gap-3">
              <button type="button" className="btn-gold flex-1 bg-error" disabled={busy} onClick={remove}>{t("app.log.delete_confirm")}</button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>{t("app.account.cancel")}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost border-error/60 text-error" onClick={() => setConfirmDelete(true)}>{t("app.log.delete")}</button>
        )
      ) : null}
      <CardChooser
        open={target !== null}
        context={contextFor(target)}
        only={pairs && target?.kind === "card" ? "major" : pairs && target?.kind === "clarifier" ? "minor" : null}
        initial={current(target)}
        taken={taken}
        onChoose={choose}
        onClose={() => setTarget(null)}
      />
    </form>
  );
}
