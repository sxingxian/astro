import { describe, expect, it, vi } from "vitest";
import { busy } from "../src/busy";

describe("busy", () => {
  it("is busy while any screen load is still going, and tells listeners when that changes", async () => {
    const seen: boolean[] = [];
    const stop = busy.subscribe(() => seen.push(busy.get()));
    expect(busy.get()).toBe(false);
    let finishA!: () => void;
    let failB!: (e: Error) => void;
    const a = busy.track(new Promise<void>((r) => (finishA = r)));
    const b = busy.track(new Promise<void>((_, j) => (failB = j)));
    expect(busy.get()).toBe(true);
    finishA();
    await a;
    expect(busy.get()).toBe(true);
    failB(new Error("x"));
    await expect(b).rejects.toThrow("x");
    expect(busy.get()).toBe(false);
    stop();
    expect(seen).toEqual([true, false]);
  });

  it("counts a load that isn't a promise (a screen's code downloading) with start and its stop function", () => {
    const done = busy.start();
    expect(busy.get()).toBe(true);
    done();
    done();
    expect(busy.get()).toBe(false);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const fn = vi.fn();
    busy.subscribe(fn)();
    busy.start()();
    expect(fn).not.toHaveBeenCalled();
  });
});
