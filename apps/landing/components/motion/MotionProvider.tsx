"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useRef, type ReactNode } from "react";
import { registerEases } from "./ease";
import { buildDeckLoop } from "./timelines/deck";
import { buildHero } from "./timelines/hero";
import { buildPairs } from "./timelines/pairs";
import { buildReveals } from "./timelines/reveals";
import { buildThread } from "./timelines/thread";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Moves focus to an anchor target after scrolling, so keyboard and screen-reader users land where they asked. */
function focusTarget(target: HTMLElement) {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      registerEases();
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add({ reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
        const reduced = Boolean(ctx.conditions?.reduce);
        const cleanups: Array<() => void> = [];

        let lenis: Lenis | null = null;
        if (!reduced) {
          lenis = new Lenis({ lerp: 0.1 });
          lenis.on("scroll", ScrollTrigger.update);
          const tick = (time: number) => lenis?.raf(time * 1000);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          cleanups.push(() => {
            gsap.ticker.remove(tick);
            lenis?.destroy();
          });
        }

        const onClick = (e: MouseEvent) => {
          const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
          const id = link?.getAttribute("href")?.slice(1);
          const target = id ? document.getElementById(id) : null;
          if (!target) return;
          e.preventDefault();
          history.pushState(null, "", `#${id}`);
          if (lenis) lenis.scrollTo(target, { offset: 0, onComplete: () => focusTarget(target) });
          else {
            target.scrollIntoView();
            focusTarget(target);
          }
        };
        document.addEventListener("click", onClick);
        cleanups.push(() => document.removeEventListener("click", onClick));

        const heroCleanup = buildHero(el, reduced);
        if (heroCleanup) cleanups.push(heroCleanup);
        buildReveals(el, reduced);
        // Marks that motion is set up, and which mode, for styling and for the browser tests.
        document.documentElement.dataset.motion = reduced ? "reduced" : "full";
        cleanups.push(() => delete document.documentElement.dataset.motion);

        if (!reduced) {
          buildPairs(el);
          buildThread(el);

          const progress = el.querySelector('[data-anim="progress"]');
          if (progress) {
            gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: true } });
          }

          const deckSection = el.querySelector<HTMLElement>("#deck");
          if (deckSection) {
            const loop = buildDeckLoop(deckSection);
            ScrollTrigger.create({
              trigger: deckSection,
              start: "top bottom",
              end: "bottom top",
              onToggle: (self) => (self.isActive ? loop.play() : loop.pause())
            });
          }
        }

        return () => cleanups.forEach((fn) => fn());
      });
    },
    { scope: root }
  );

  return <div ref={root}>{children}</div>;
}
