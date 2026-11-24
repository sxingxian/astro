import { gsap } from "gsap";

/** Hero entrance on load, gentle bob, and the scroll-out as the page moves on. */
export function buildHero(root: HTMLElement, reduced: boolean) {
  const card = root.querySelector('[data-anim="hero-card"]');
  const lines = root.querySelectorAll('[data-anim="hero-line"]');
  const intro = root.querySelectorAll('[data-anim="hero-intro"]');
  const out = root.querySelector('[data-anim="hero-out"]');

  if (reduced) {
    gsap.from([card, ...intro, ...lines], { opacity: 0, duration: 0.4, ease: "none" });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: "astroOut" } });
  if (card) tl.from(card, { opacity: 0, y: 48, rotationY: -70, rotationX: 14, transformPerspective: 900, duration: 1.6 }, 0.15);
  tl.from(lines, { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.45);
  tl.from(intro, { opacity: 0, y: 28, duration: 1, stagger: 0.08 }, 0.35);
  if (card) gsap.to(card, { y: -12, duration: 3.6, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.8 });

  if (out) {
    gsap.to(out, {
      opacity: 0,
      y: -90,
      scale: 0.98,
      ease: "none",
      scrollTrigger: { trigger: "#top", start: "top top", end: "+=640", scrub: true }
    });
  }

  gsap.utils.toArray<HTMLElement>(".orbit").forEach((orbit, i) => {
    gsap.to(orbit, { rotation: i % 2 ? -360 : 360, duration: i % 2 ? 360 : 240, ease: "none", repeat: -1 });
  });

  if (card && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.7, ease: "astroOut" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.7, ease: "astroOut" });
    const onMove = (e: PointerEvent) => {
      ry((e.clientX / window.innerWidth - 0.5) * 16);
      rx(-(e.clientY / window.innerHeight - 0.5) * 12);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }
}
