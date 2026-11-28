import { getCard } from "@astro/cards";
import type { CSSProperties } from "react";
import { glyphFor } from "./glyphs";

interface Props {
  id: string;
  size?: "lg" | "md" | "sm";
  label?: string;
  /** Turns the whole card upside down, as a reversed card lies on the table. */
  reversed?: boolean;
  /** Shown under a reversed card, outside it, so it's never upside down. */
  reversedLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const sizes = {
  lg: { box: "w-[104px] h-[176px] px-2 py-3.5", num: "text-[15px]", glyph: 58, name: "text-[17px]" },
  md: { box: "w-[128px] h-[216px] px-2.5 py-4", num: "text-base", glyph: 64, name: "text-lg" },
  sm: { box: "w-[92px] h-[150px] px-1.5 py-2.5", num: "text-[10px]", glyph: 36, name: "text-sm" }
} as const;

export function CardFace({ id, size = "md", label, reversed = false, reversedLabel, className = "", style }: Props) {
  const card = getCard(id);
  const s = sizes[size];
  const face = (
    <div
      role="img"
      aria-label={reversed ? `${card.name}, reversed` : card.name}
      className={`card-face ${s.box} ${className}`}
      style={reversed ? { ...style, transform: "rotate(180deg)" } : style}
      data-reversed={reversed || undefined}
    >
      <span className={`font-display tracking-[0.18em] text-gold ${s.num}`}>{label ?? card.numeral}</span>
      <svg width={s.glyph} height={s.glyph} viewBox="0 0 64 60" aria-hidden="true">
        <path d={glyphFor(card.id, card.suit)} fill="none" stroke="#D8B46A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`w-full text-balance font-display leading-tight [overflow-wrap:anywhere] ${s.name}`}>{card.name}</span>
    </div>
  );
  if (!reversed || !reversedLabel) return face;
  return (
    <figure className="card-figure">
      {face}
      <figcaption className="card-reversed">{reversedLabel}</figcaption>
    </figure>
  );
}
