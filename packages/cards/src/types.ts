export type Arcana = "major" | "minor";
export type Suit = "wands" | "cups" | "swords" | "pentacles";
export type Element = "fire" | "water" | "air" | "earth";

export interface Card {
  id: string;
  name: string;
  arcana: Arcana;
  suit: Suit | null;
  number: number;
  numeral: string;
  element: Element;
  keywords: [string, string, string];
}
