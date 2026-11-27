export type Surface = "landing" | "app" | "email" | "legal";

/** One piece of wording: where it shows, its default (today's text), its length limit and its {placeholders}. */
export interface CopyEntry {
  key: string;
  surface: Surface;
  group: string;
  label: string;
  where: string;
  default: string;
  max: number;
  placeholders: readonly string[];
  /** "doc" entries hold a JSON block document (doc.ts) instead of plain text. */
  format?: "text" | "doc";
}

export type EntrySpec = Omit<CopyEntry, "key" | "surface" | "placeholders">;
