import type { Meaning } from "./types";

/**
 * The editable parts of a card's meaning, as override keys "<cardId>.<field>". Bodies are paragraphs separated by
 * a blank line. Majors have "as_theme", Minors "as_clarifier".
 */
export const MEANING_FIELDS = [
  { field: "upright.summary", label: "Upright: summary", max: 140 },
  { field: "upright.body", label: "Upright: meaning", max: 3000 },
  { field: "reversed.summary", label: "Reversed: summary", max: 140 },
  { field: "reversed.body", label: "Reversed: meaning", max: 3000 },
  { field: "as_theme", label: "As the theme of a position", max: 500 },
  { field: "as_clarifier", label: "As the clarifier", max: 500 },
  { field: "positions.past", label: "In the past position", max: 400 },
  { field: "positions.present", label: "In the present position", max: 400 },
  { field: "positions.future", label: "In the future position", max: 400 }
] as const;

export type MeaningField = (typeof MEANING_FIELDS)[number]["field"];

const paragraphs = (text: string) => text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);

/** The current text of one field, as the editor shows it. */
export function fieldText(m: Meaning, field: MeaningField): string | undefined {
  switch (field) {
    case "upright.summary": return m.upright.summary;
    case "upright.body": return m.upright.body.join("\n\n");
    case "reversed.summary": return m.reversed.summary;
    case "reversed.body": return m.reversed.body.join("\n\n");
    case "as_theme": return m.asTheme;
    case "as_clarifier": return m.asClarifier;
    case "positions.past": return m.positions.past;
    case "positions.present": return m.positions.present;
    case "positions.future": return m.positions.future;
  }
}

/** A meaning with overrides applied (keys "<cardId>.<field>"). Fields the card doesn't have are ignored. */
export function applyOverrides(m: Meaning, overrides: Readonly<Record<string, string>>): Meaning {
  const o = (field: MeaningField) => overrides[`${m.cardId}.${field}`];
  return {
    ...m,
    upright: { summary: o("upright.summary") ?? m.upright.summary, body: o("upright.body") !== undefined ? paragraphs(o("upright.body")!) : m.upright.body },
    reversed: { summary: o("reversed.summary") ?? m.reversed.summary, body: o("reversed.body") !== undefined ? paragraphs(o("reversed.body")!) : m.reversed.body },
    asTheme: m.asTheme !== undefined ? (o("as_theme") ?? m.asTheme) : undefined,
    asClarifier: m.asClarifier !== undefined ? (o("as_clarifier") ?? m.asClarifier) : undefined,
    positions: { past: o("positions.past") ?? m.positions.past, present: o("positions.present") ?? m.positions.present, future: o("positions.future") ?? m.positions.future }
  };
}
