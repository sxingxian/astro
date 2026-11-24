"use client";

import { useEffect, useRef, useState } from "react";
import { canUseWebGL } from "./canUseWebGL";

/** WebGL starfield over the static SVG sky. Not mounted with reduced motion or without WebGL. */
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && canUseWebGL()) setEnabled(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    import("./createStarfield").then(({ createStarfield }) => {
      if (disposed) return;
      const field = createStarfield(canvas, { count: window.innerWidth < 768 ? 700 : 1200, reducedMotion: false });
      field.resize();
      let inView = true;
      const update = () => (inView && document.visibilityState === "visible" ? field.start() : field.stop());
      const io = new IntersectionObserver(([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        update();
      });
      io.observe(canvas);
      const onResize = () => field.resize();
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", update);
      update();
      cleanup = () => {
        io.disconnect();
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", update);
        field.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} data-starfield aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
