"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { useT } from "../CopyProvider";
import { postJson } from "@/lib/client";
import { go } from "@/lib/go";

const OPTIONS = [
  { value: "fit", label: "app.check_in.fit" },
  { value: "partly", label: "app.check_in.partly" },
  { value: "not", label: "app.check_in.not" }
] as const;

export function CheckInForm({ sessionId }: { sessionId: string }) {
  const t = useT();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(value: string, note?: string) {
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/check-in/${sessionId}`, { outcome: value, note });
    setBusy(false);
    if (res.ok || res.data.error === "already_done") return go("/today");
    setError(t("app.check_in.save_failed"));
  }

  return (
    <form className="flex flex-1 flex-col gap-5" onSubmit={(e) => {
      e.preventDefault();
      if (!outcome) return setError(t("app.check_in.choose"));
      void send(outcome, String(new FormData(e.currentTarget).get("note") ?? ""));
    }}>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-3 p-0 font-display text-2xl">{t("app.check_in.question")}</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${outcome === o.value ? "border-gold bg-[#1C1838]" : "border-gold/25 bg-ink"}`}>
            <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="size-5 accent-gold" />
            {t(o.label)}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="ci-note">{t("app.check_in.note_label")} <span className="text-muted">{t("app.check_in.optional")}</span></label>
        <textarea id="ci-note" name="note" rows={3} maxLength={500} className="input resize-none py-3" />
      </div>
      <FormError message={error} />
      <div className="mt-auto flex flex-col gap-1">
        <button type="submit" className="btn-gold" disabled={busy}>{t("app.check_in.save")}</button>
        <button type="button" className="btn-ghost border-0" disabled={busy} onClick={() => void send("skipped")}>{t("app.check_in.skip")}</button>
        <p className="mb-0 mt-2 text-center text-xs text-muted">{t("app.check_in.privacy")}</p>
      </div>
    </form>
  );
}
