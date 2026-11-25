/** Simple line glyphs (64×60 viewBox) used on card faces until final art lands. */
export const glyphs: Record<string, string> = {
  "the-tower": "M20 52h24M24 52V20h16v32M22 20l10-9 10 9M35 26l-5 8h6l-5 9",
  strength: "M14 30c0-7 9-7 18 0s18 7 18 0-9-7-18 0-18 7-18 0z",
  "the-sun": "M32 21a9 9 0 1 0 .01 0M32 6v7M32 47v7M14 30h7M43 30h7M19 17l5 5M40 38l5 5M19 43l5-5M40 22l5-5",
  "the-star": "M32 6l4 18 18 4-18 4-4 18-4-18-18-4 18-4z",
  pentacles: "M32 12l4.7 14.5h15.2l-12.3 9 4.7 14.5-12.3-9-12.3 9 4.7-14.5-12.3-9h15.2z",
  cups: "M20 14h24c0 12-5 19-12 19s-12-7-12-19zM32 33v10M24 46h16",
  wands: "M22 50L42 10M40 15l5-2M37 22l5-1M34 29l4 0",
  swords: "M32 6v38M24 38h16M32 44v8"
};

export function glyphFor(id: string, suit: string | null): string {
  return glyphs[id] ?? (suit ? glyphs[suit] : undefined) ?? glyphs["the-star"]!;
}
