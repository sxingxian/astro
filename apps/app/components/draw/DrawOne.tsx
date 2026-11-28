"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "../AuthShell";
import { Turnstile } from "../Turnstile";
import { useT } from "../CopyProvider";
import { FingerprintText } from "./FingerprintText";
import { FanPicker } from "./FanPicker";
import { PickerLayout } from "./PickerLayout";
import { pickCards, startReading, type StartState } from "@/lib/draw/client";
import { go } from "@/lib/go";

export function DrawOne({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
  const t = useT();
  const [state, setState] = useState<StartState | null>(null);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (token?: string) => {
    setError(null);
    const out = await startReading("one", token);
    if (out.kind === "done") return go(`/reading/${out.sessionId}`, { replace: true });
    if (out.kind === "needs-check") return setNeedsCheck(true);
    if (out.kind === "error") return setError(t(out.message));
    if (out.kind === "ready") { setNeedsCheck(false); setState(out.state); }
  }, []);

  useEffect(() => { void start(); }, [start]);
  const onToken = useCallback((t: string) => { if (t) void start(t); }, [start]);

  const deck = state?.decks[0];
  async function turn() {
    if (!state || selected.length !== 1) return;
    setBusy(true);
    const ok = await pickCards(state.sessionId, "single", selected);
    if (ok) return go(`/reading/${state.sessionId}`, { replace: true }); // the finished draw screen leaves history
    setBusy(false);
    setError(t("app.draw.failed"));
  }

  return (
    <PickerLayout
      eyebrow={t("app.draw.one_eyebrow")}
      title={deck ? t("app.draw.shuffled") : t("app.draw.shuffling_title")}
      lede={t("app.draw.touch")}
      slots={[{ label: t("app.draw.your_card"), filled: selected.length === 1 }]}
      fan={
        <>
          {needsCheck ? <div className="px-5 lg:px-0"><p className="mb-3 mt-0 text-sm text-haze">{t("app.draw.quick_check")}</p><Turnstile mode={mode} siteKey={siteKey} action="draw" onToken={onToken} /></div> : null}
          {deck ? <FanPicker size={deck.size} selected={selected} limit={1} label={t("app.draw.fan_one")} onToggle={(i) => setSelected([i])} /> : null}
        </>
      }
      footer={
        deck ? (
          <>
            <p className="m-0 text-sm text-haze" aria-live="polite">{selected.length ? t("app.draw.chosen_one") : t("app.draw.chosen_none")}</p>
            <FormError message={error} />
            <button type="button" className="btn-gold lg:self-start lg:px-10" disabled={selected.length !== 1 || busy} onClick={() => void turn()}>{t("app.draw.turn")}</button>
            <FingerprintText fingerprint={deck.fingerprint} label={t("app.draw.fingerprint")} />
            <p className="m-0 text-xs text-muted">{t("app.draw.one_note")}</p>
          </>
        ) : (
          <FormError message={error} />
        )
      }
    />
  );
}
