"use client";

import { MONTHS } from "@astro/copy/dates";
import { dateParts, daysIn, joinDate, yearsFor } from "@/lib/date-field";

/**
 * A date as three dropdowns, read "01 Jan 2016" in every browser (the native date field follows the browser's own
 * language, so it could show 11/28/2026). `value` and `onChange` use "YYYY-MM-DD".
 */
export function DateField({ id, label, value, onChange, names }: { id: string; label: string; value: string; onChange: (v: string) => void; names: { day: string; month: string; year: string } }) {
  const p = dateParts(value);
  const set = (part: Partial<typeof p>) => onChange(joinDate({ ...p, ...part }));
  const select = "input min-w-0 px-2.5";
  return (
    <fieldset id={id} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm text-haze">{label}</legend>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
        <select aria-label={names.day} className={select} value={p.day} onChange={(e) => set({ day: Number(e.target.value) })}>
          {Array.from({ length: daysIn(p.month, p.year) }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{String(d).padStart(2, "0")}</option>)}
        </select>
        <select aria-label={names.month} className={select} value={p.month} onChange={(e) => set({ month: Number(e.target.value) })}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select aria-label={names.year} className={select} value={p.year} onChange={(e) => set({ year: Number(e.target.value) })}>
          {yearsFor(new Date().getFullYear(), p.year).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </fieldset>
  );
}
