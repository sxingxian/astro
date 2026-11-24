import { gsap } from "gsap";

/** Majors flip in one after another, then each Minor tucks in behind its Major. */
export function buildPairs(root: HTMLElement) {
  const grid = root.querySelector(".pairs-grid");
  if (!grid) return;
  const majors = grid.querySelectorAll('[data-anim="pair-major"]');
  const minors = grid.querySelectorAll('[data-anim="pair-minor"]');
  const tl = gsap.timeline({ scrollTrigger: { trigger: grid, start: "top 75%", once: true }, defaults: { ease: "astroOut" } });
  tl.from(majors, { opacity: 0, y: 20, rotationY: 85, transformPerspective: 800, duration: 0.9, stagger: 0.15 });
  tl.from(minors, { opacity: 0, x: -30, y: 40, rotation: -8, duration: 0.8, stagger: 0.15 }, "-=0.45");
}
