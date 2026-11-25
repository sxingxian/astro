// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildDeckLoop } from "./deck";

function deckDom() {
  const root = document.createElement("section");
  for (let i = 0; i < 22; i++) {
    const angle = -31.5 + i * 3;
    const riffle = (i % 2 === 0 ? 1 : -1) * (54 + (i % 5) * 6);
    const card = document.createElement("div");
    card.dataset.angle = String(angle);
    card.dataset.riffle = String(riffle);
    card.dataset.index = String(i);
    if (i === 13) {
      card.dataset.anim = "deck-chosen";
      card.innerHTML = '<div data-anim="deck-glow"></div><div data-anim="deck-flipper"></div>';
    } else {
      card.dataset.anim = "deck-card";
    }
    root.appendChild(card);
  }
  for (let i = 0; i < 3; i++) {
    const step = document.createElement("li");
    step.dataset.anim = "deck-step";
    root.appendChild(step);
  }
  document.body.appendChild(root);
  return root;
}

describe("buildDeckLoop", () => {
  it("is a 9 second infinitely repeating timeline", () => {
    const tl = buildDeckLoop(deckDom());
    expect(tl.duration()).toBeCloseTo(9, 5);
    expect(tl.repeat()).toBe(-1);
  });

  it("flips the chosen card to rotationY 180 at 4.5s (0.50 × 9)", () => {
    const root = deckDom();
    const flipper = root.querySelector('[data-anim="deck-flipper"]');
    const tl = buildDeckLoop(root);
    const flip = tl.getChildren(true, true, false).find((t) => {
      const tween = t as gsap.core.Tween;
      return tween.targets().includes(flipper) && tween.vars.rotationY === 180;
    });
    expect(flip).toBeDefined();
    expect(flip!.startTime()).toBeCloseTo(4.5, 5);
  });
});
