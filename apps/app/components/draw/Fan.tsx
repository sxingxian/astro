"use client";

import { CardBack } from "@astro/ui";
import { useRef } from "react";

interface Props {
  size: number;
  selected: number[];
  limit: number;
  locked?: boolean;
  label: string;
  onToggle: (position: number) => void;
}

/** Face-down cards as buttons: one tab stop for the group, arrow keys move between cards (roving tabindex). */
export function Fan({ size, selected, limit, locked = false, label, onToggle }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(size - 1, i))]?.focus();
  const tabStop = selected[0] ?? 0;

  return (
    <div role="group" aria-label={label} className="fan">
      {Array.from({ length: size }, (_, i) => {
        const pressed = selected.includes(i);
        return (
          <button
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            className="fan-card"
            aria-label={`Card ${i + 1} of ${size}`}
            aria-pressed={pressed}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={locked}
            onClick={() => (pressed || selected.length < limit || limit === 1) && onToggle(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); focusAt(i + 1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); focusAt(i - 1); }
              if (e.key === "Home") { e.preventDefault(); focusAt(0); }
              if (e.key === "End") { e.preventDefault(); focusAt(size - 1); }
            }}
          >
            <CardBack />
          </button>
        );
      })}
    </div>
  );
}
