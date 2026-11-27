import type { ReactNode } from "react";

/** The reader guidelines document in a scrolling, keyboard-reachable box. */
export function GuidelinesBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} tabIndex={0} className="max-h-[320px] overflow-y-auto rounded-2xl border border-gold/20 bg-[rgba(20,20,42,.85)] p-5 text-sm focus:outline-2 focus:outline-gold">
      {children}
    </section>
  );
}
