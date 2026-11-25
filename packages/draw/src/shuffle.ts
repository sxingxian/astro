import { secureRandomInt, type RandomInt } from "./random";

/** Fisher–Yates shuffle. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rand: RandomInt = secureRandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export type Orientation = "upright" | "reversed";

/** Decides each card's orientation at shuffle time. `reversalRate` is 0..1. */
export function assignOrientations(order: readonly string[], reversalRate: number, rand: RandomInt = secureRandomInt): Orientation[] {
  if (!(reversalRate >= 0 && reversalRate <= 1)) {
    throw new RangeError(`reversalRate must be between 0 and 1, got ${reversalRate}`);
  }
  const threshold = Math.round(reversalRate * 10_000);
  return order.map(() => (rand(10_000) < threshold ? "reversed" : "upright"));
}
