import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Scroll reveals: rise and fade, 60ms stagger per batch. With reduced motion nothing is hidden or
 * animated: every section is visible from the start.
 */
export function buildReveals(root: HTMLElement, reduced: boolean) {
  if (reduced) return;
  const items = gsap.utils.toArray<HTMLElement>('[data-anim="reveal"]', root);
  gsap.set(items, { opacity: 0, y: 28 });
  ScrollTrigger.batch(items, {
    start: "top 85%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: "astroOut", stagger: 0.06, overwrite: true })
  });
}
