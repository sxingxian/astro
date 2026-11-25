"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { postJson } from "@/lib/client";

const OPTIONS = [
  { value: "fit", label: "It fit" },
  { value: "partly", label: "Partly" },
  { value: "not", label: "Not really" }
] as const;

export function CheckInForm({ sessionId }: { sessionId: string }) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(value: string, note?: string) {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/check-in/${sessionId}`, { outcome: value, note });
    setBusy(false);
    if (res.ok || res.data.error === "already_done") return window.location.assign("/today");
    setError("Couldn't save your check-in. Please try again.");
  }

  return (
    <form className="flex flex-1 flex-col gap-5" onSubmit={(e) => {
      e.preventDefault();
      if (!outcome) return setError("Choose how it turned out, or skip this one.");
      void send(outcome, String(new FormData(e.currentTarget).get("note") ?? ""));
    }}>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-3 p-0 font-display text-2xl">How did it turn out?</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${outcome === o.value ? "border-gold bg-[#1C1838]" : "border-gold/25 bg-ink"}`}>
            <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="size-5 accent-gold" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="ci-note">What happened? <span className="text-muted">(optional)</span></label>
        <textarea id="ci-note" name="note" rows={3} maxLength={500} className="input resize-none py-3" />
      </div>
      <FormError message={error} />
      <div className="mt-auto flex flex-col gap-1">
        <button type="submit" className="btn-gold" disabled={busy}>Save check-in</button>
        <button type="button" className="btn-ghost border-0" disabled={busy} onClick={() => void send("skipped")}>Skip this one</button>
        <p className="mb-0 mt-2 text-center text-xs text-muted">Private to you. It only feeds your Patterns. Turn check-ins off in Account.</p>
      </div>
    </form>
  );
}
