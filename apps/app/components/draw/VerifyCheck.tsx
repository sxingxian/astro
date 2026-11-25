"use client";

import { fingerprintOf, formatFingerprint, type Orientation } from "@astro/draw";
import { useEffect, useId, useState } from "react";

interface Props {
  title: string;
  order: string[];
  names: string[];
  orientations: Orientation[];
  salt: string;
  fingerprint: string;
  picks: number[];
}

/** Recomputes the fingerprint in your own browser from the revealed order, orientations and salt. */
export function VerifyCheck({ title, order, names, orientations, salt: initialSalt, fingerprint, picks }: Props) {
  const [salt, setSalt] = useState(initialSalt);
  const [computed, setComputed] = useState<string | null>(null);
  const id = useId();
  useEffect(() => {
    let live = true;
    fingerprintOf(order, orientations, salt.trim()).then((fp) => live && setComputed(fp)).catch(() => live && setComputed(""));
    return () => { live = false; };
  }, [order, orientations, salt]);
  const matches = computed === fingerprint;
  const json = JSON.stringify({ order, orientations, salt: salt.trim(), fingerprint }, null, 2);

  return (
    <section aria-labelledby={`${id}-h`} className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="m-0 font-display text-2xl font-medium">{title}</h2>
        <span aria-live="polite" className={`rounded-full px-3 py-1 text-sm font-semibold ${computed === null ? "text-muted" : matches ? "bg-gold text-night" : "bg-error text-night"}`}>
          {computed === null ? "Checking…" : matches ? "Matches ✓" : "Doesn't match"}
        </span>
      </div>
      <p className="m-0 text-sm text-haze">Shown before you picked: <code className="font-mono text-moon">{formatFingerprint(fingerprint)}</code></p>
      <div className="field">
        <label htmlFor={`${id}-salt`}>Salt</label>
        <input id={`${id}-salt`} className="input font-mono text-sm" value={salt} onChange={(e) => setSalt(e.target.value)} spellCheck={false} autoComplete="off" />
      </div>
      <p className="m-0 text-sm text-haze">You picked positions {picks.map((p) => p + 1).join(", ")}: {picks.map((p) => names[p]).join(", ")}.</p>
      <details className="text-sm">
        <summary className="cursor-pointer text-gold">Show all {order.length} positions</summary>
        <ol className="mt-3 flex flex-col gap-1 pl-6 text-haze">
          {order.map((cardId, i) => (
            <li key={cardId} className={picks.includes(i) ? "font-semibold text-gold" : ""}>{names[i]}{orientations[i] === "reversed" ? " (reversed)" : ""}</li>
          ))}
        </ol>
      </details>
      <details className="text-sm">
        <summary className="cursor-pointer text-gold">Check it yourself</summary>
        <p className="mb-2 mt-3 text-haze">The fingerprint is the first 32 characters of <code className="text-moon">sha256(order.join(",") + "|" + orientations.join(",") + ":" + salt)</code>.</p>
        <pre className="max-h-64 overflow-auto rounded-xl bg-night p-3 text-xs text-haze">{json}</pre>
      </details>
    </section>
  );
}
