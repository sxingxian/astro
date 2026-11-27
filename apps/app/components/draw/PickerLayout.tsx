"use client";

import { CardBack } from "@astro/ui";
import type { ReactNode } from "react";
import { useT } from "../CopyProvider";

/**
 * Where the fan lives. Phones follow the approved prototype: heading, a row of slots that fill as cards are picked,
 * the fan, then the button. Desktop follows mockup D2: one glowing panel with the heading on the left, the slots
 * top-right, the fan across the panel and the hint and button underneath.
 */
export function PickerLayout({ eyebrow, title, lede, note, slots, fan, footer }: { eyebrow: string; title: string; lede?: string; note?: string; slots: { label: string; filled: boolean }[]; fan: ReactNode; footer: ReactNode }) {
  const t = useT();
  const filled = slots.filter((s) => s.filled).length;
  return (
    <section aria-labelledby="pick-h" className="picker flex flex-col gap-3 lg:gap-4 lg:rounded-3xl lg:border lg:border-gold/15 lg:p-7">
      <div className="flex flex-col gap-4 px-5 lg:flex-row lg:items-end lg:justify-between lg:px-0">
        <div className="flex flex-col gap-2 text-center lg:text-left">
          <p className="eyebrow">{eyebrow}</p>
          {note ? <p className="m-0 text-sm text-muted">{note}</p> : null}
          <h1 id="pick-h" className="m-0 font-display text-[32px] font-medium leading-tight lg:text-4xl">{title}</h1>
          {lede ? <p className="m-0 text-haze">{lede}</p> : null}
        </div>
        <ol aria-label={t("app.draw.picks_label", { n: String(filled), total: String(slots.length) })} className="m-0 flex list-none justify-center gap-2.5 p-0 lg:flex-none">
          {slots.map((s) => (
            <li key={s.label} className="flex flex-col items-center gap-1.5">
              <span data-filled={s.filled || undefined} className="picker-slot">{s.filled ? <CardBack /> : null}</span>
              <span className="text-xs text-haze">{s.label}{s.filled ? " ✓" : ""}</span>
            </li>
          ))}
        </ol>
      </div>
      {fan}
      <div className="flex flex-col gap-3 px-5 lg:px-0">{footer}</div>
    </section>
  );
}
