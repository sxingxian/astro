import { describe, expect, it } from "vitest";
import { PickError, pickAt } from "../src/index";

const order = Array.from({ length: 22 }, (_, i) => `card-${i}`);

describe("pickAt", () => {
  it("returns the card at the position", () => {
    expect(pickAt(order, 6, [])).toBe("card-6");
  });
  it.each([-1, 22, 2.5])("rejects position %s", (pos) => {
    expect(() => pickAt(order, pos, [])).toThrow(PickError);
  });
  it("rejects a position already taken", () => {
    expect(() => pickAt(order, 6, [6])).toThrow(PickError);
  });
});
