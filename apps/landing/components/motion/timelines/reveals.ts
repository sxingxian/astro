import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Scroll reveals: rise and fade (opacity only when motion is reduced), 60ms stagger per batch. */
export function buildReveals(root: HTMLElement, reduced: boolean) {
  const items = gsap.utils.toArray<HTMLElement>('[data-anim="reveal"]', root);
  const from = reduced ? { opacity: 0 } : { opacity: 0, y: 28 };
  gsap.set(items, from);
  ScrollTrigger.batch(items, {
    start: "top 85%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: reduced ? 0.4 : 0.9, ease: reduced ? "none" : "astroOut", stagger: 0.06, overwrite: true })
  });
}
