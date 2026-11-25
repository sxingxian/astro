import { getCard } from "@astro/cards";
import type { CSSProperties } from "react";
import { glyphFor } from "./glyphs";

interface Props {
  id: string;
  size?: "lg" | "md" | "sm";
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const sizes = {
  lg: { box: "w-[104px] h-[176px] px-2 py-3.5", num: "text-[15px]", glyph: 58, name: "text-[17px]" },
  md: { box: "w-[128px] h-[216px] px-2.5 py-4", num: "text-base", glyph: 64, name: "text-lg" },
  sm: { box: "w-[92px] h-[150px] px-1.5 py-2.5", num: "text-[10px]", glyph: 36, name: "text-sm" }
} as const;

export function CardFace({ id, size = "md", label, className = "", style }: Props) {
  const card = getCard(id);
  const s = sizes[size];
  return (
    <div role="img" aria-label={card.name} className={`card-face ${s.box} ${className}`} style={style}>
      <span className={`font-display tracking-[0.18em] text-gold ${s.num}`}>{label ?? card.numeral}</span>
      <svg width={s.glyph} height={s.glyph} viewBox="0 0 64 60" aria-hidden="true">
        <path d={glyphFor(card.id, card.suit)} fill="none" stroke="#D8B46A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`font-display leading-tight ${s.name}`}>{card.name}</span>
    </div>
  );
}
