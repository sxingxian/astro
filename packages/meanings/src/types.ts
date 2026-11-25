export interface Side {
  /** One line, 4–14 words. */
  summary: string;
  /** The elaborated meaning, in paragraphs. */
  body: string[];
}

export interface Meaning {
  cardId: string;
  upright: Side;
  reversed: Side;
  /** Majors: what the card means as the theme of a 3-card position. */
  asTheme?: string;
  /** Minors: what the card means as the clarifier beside a Major. */
  asClarifier?: string;
  positions: { past: string; present: string; future: string };
}
