import type { LogFormValue } from "@/components/reader-log/LogForm";
import type { T } from "@astro/copy";
import type { Entry } from "./reader-log";

/** What the record form starts with: an existing entry, or a blank one-card reading dated today. */
export function formValue(t: T, today: string, e?: Entry): LogFormValue {
  if (!e) return { readOn: today, place: "in_person", name: "", question: "", notes: "", consent: false, spread: "one", positions: [{ label: t("app.log.pos_card"), card: null, clarifier: null }], extras: [] };
  return {
    id: e.id,
    readOn: e.readOn,
    place: e.place,
    name: e.name,
    question: e.question ?? "",
    notes: e.notes ?? "",
    consent: e.consent,
    spread: e.spread,
    positions: e.cards.positions.map((p) => ({ label: p.label, card: p.card, clarifier: p.clarifier ?? null })),
    extras: e.cards.extras
  };
}
