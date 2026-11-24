import { gsap } from "gsap";
import { registerEases } from "../ease";

export const DECK_LOOP_SECONDS = 9;
const STAGGER = 0.014;

/**
 * The 9-second deck ritual: riffle twice, fan out, lift the chosen card,
 * flip it to reveal, flip back and gather. Phase boundaries are fractions of 9s.
 */
export function buildDeckLoop(root: HTMLElement): gsap.core.Timeline {
  registerEases();
  const D = DECK_LOOP_SECONDS;
  const at = (fraction: number) => fraction * D;
  const tl = gsap.timeline({ repeat: -1, paused: true });

  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-anim="deck-card"], [data-anim="deck-chosen"]'));
  const chosen = root.querySelector<HTMLElement>('[data-anim="deck-chosen"]');
  const flipper = root.querySelector<HTMLElement>('[data-anim="deck-flipper"]');
  const glow = root.querySelector<HTMLElement>('[data-anim="deck-glow"]');
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-anim="deck-step"]'));

  cards.forEach((card, i) => {
    const angle = Number(card.dataset.angle ?? 0);
    const riffle = Number(card.dataset.riffle ?? 0);
    const d = Number(card.dataset.index ?? i) * STAGGER;
    tl.set(card, { x: 0, y: 60, rotation: 0, transformOrigin: "50% 900px" }, 0);
    tl.to(card, { x: riffle, duration: at(0.07), ease: "astroInOut" }, at(0) + d);
    tl.to(card, { x: 0, duration: at(0.06), ease: "astroInOut" }, at(0.07) + d);
    tl.to(card, { x: -riffle, duration: at(0.06), ease: "astroInOut" }, at(0.13) + d);
    tl.to(card, { x: 0, duration: at(0.06), ease: "astroInOut" }, at(0.19) + d);
    tl.to(card, { rotation: angle, y: 0, duration: at(0.13), ease: "astroOut" }, at(0.25) + d);
    if (card === chosen) {
      tl.to(card, { y: -84, duration: at(0.1), ease: "astroOut" }, at(0.38));
      tl.to(card, { y: 0, duration: at(0.06), ease: "astroInOut" }, at(0.82));
    }
    tl.to(card, { rotation: 0, y: 60, duration: at(0.1), ease: "astroInOut" }, at(0.86) + d);
  });

  if (flipper) {
    tl.set(flipper, { rotationY: 0 }, 0);
    tl.to(flipper, { rotationY: 180, duration: at(0.1), ease: "astroInOut" }, at(0.5));
    tl.to(flipper, { rotationY: 0, duration: at(0.08), ease: "astroInOut" }, at(0.78));
  }
  if (glow) {
    tl.set(glow, { opacity: 0 }, 0);
    tl.to(glow, { opacity: 1, duration: at(0.1), ease: "astroOut" }, at(0.42));
    tl.to(glow, { opacity: 0, duration: at(0.08), ease: "astroInOut" }, at(0.8));
  }
  const [s1, s2, s3] = steps;
  if (s1 && s2 && s3) {
    tl.set([s2, s3], { opacity: 0.55 }, 0);
    tl.set(s1, { opacity: 1 }, 0);
    tl.to(s1, { opacity: 0.55, duration: at(0.06) }, at(0.32));
    tl.to(s2, { opacity: 1, duration: at(0.06) }, at(0.32));
    tl.to(s2, { opacity: 0.55, duration: at(0.06) }, at(0.48));
    tl.to(s3, { opacity: 1, duration: at(0.06) }, at(0.48));
    tl.to(s3, { opacity: 0.55, duration: at(0.06) }, at(0.86));
  }

  // Pad to exactly one loop length.
  tl.set({}, {}, D);
  return tl;
}
