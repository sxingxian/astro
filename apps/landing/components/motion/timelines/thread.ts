import { gsap } from "gsap";

/** Suit-balance bars grow from the left when the journal panel arrives. */
export function buildThread(root: HTMLElement) {
  const bars = root.querySelectorAll('[data-anim="suit-bar"]');
  if (!bars.length) return;
  gsap.from(bars, {
    scaleX: 0,
    transformOrigin: "left center",
    duration: 1,
    ease: "astroOut",
    stagger: 0.08,
    scrollTrigger: { trigger: bars[0], start: "top 85%", once: true }
  });
}
