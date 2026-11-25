export class PickError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickError";
  }
}

/** Reveals the card at a chosen position of a hidden, already-shuffled order. */
export function pickAt(order: readonly string[], position: number, taken: readonly number[]): string {
  if (!Number.isInteger(position) || position < 0 || position >= order.length) {
    throw new PickError(`Position ${position} is outside the deck of ${order.length}`);
  }
  if (taken.includes(position)) throw new PickError(`Position ${position} has already been chosen`);
  return order[position] as string;
}
