"use client";

import { CardBack } from "@astro/ui";
import { useEffect, useState, type ReactNode } from "react";

/** Shows the back, then turns to the face once on load. Reduced motion gets a short crossfade instead. */
export function FlipCard({ children, width, height, delay = 0 }: { children: ReactNode; width: number; height: number; delay?: number }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFlipped(true), 120 + delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return (
    <div className={`flip ${flipped ? "is-flipped" : ""}`} style={{ width, height }}>
      <div className="flip-inner">
        <div className="flip-side flip-back" aria-hidden="true"><CardBack /></div>
        <div className="flip-side flip-face">{children}</div>
      </div>
    </div>
  );
}
