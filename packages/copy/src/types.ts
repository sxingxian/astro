export type Surface = "landing" | "app" | "email";

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
}

export type EntrySpec = Omit<CopyEntry, "key" | "surface" | "placeholders">;
