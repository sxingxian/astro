"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "../AuthShell";
import { FanPicker } from "./FanPicker";
import { PickerLayout } from "./PickerLayout";
import { useT } from "../CopyProvider";
import { FingerprintText } from "./FingerprintText";
import { pickCards, startReading, type StartState } from "@/lib/draw/client";
import { go } from "@/lib/go";

const POSITIONS = ["app.draw.past", "app.draw.present", "app.draw.future"] as const;

export function DrawThree() {
  const t = useT();
  const [state, setState] = useState<StartState | null>(null);
  const [stage, setStage] = useState<"majors" | "minors">("majors");
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    const out = await startReading("three");
    if (out.kind === "done") return go(`/reading/${out.sessionId}`, { replace: true });
    if (out.kind === "sign-up") return go("/sign-up", { replace: true });
    if (out.kind === "error" || out.kind === "needs-check") return setError(out.kind === "error" ? t(out.message) : t("app.draw.sign_in_three"));
    setState(out.state);
    if ((out.state.decks.find((d) => d.stage === "majors")?.picks.length ?? 0) > 0) setStage("minors");
  }, []);
  useEffect(() => { void start(); }, [start]);

  const deck = state?.decks.find((d) => d.stage === stage);
  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < 3 ? [...s, i] : s));

  async function next() {
    if (!state || selected.length !== 3) return;
    setBusy(true);
    setError(null);
    const ok = await pickCards(state.sessionId, stage, selected);
    setBusy(false);
    if (!ok) return setError(t("app.draw.failed"));
    if (stage === "majors") { setStage("minors"); setSelected([]); return; }
    go(`/reading/${state.sessionId}`, { replace: true }); // the finished draw screen leaves history
  }

  const majorsDeck = state?.decks.find((d) => d.stage === "majors");
  const minorsDeck = state?.decks.find((d) => d.stage === "minors");

  return (
    <PickerLayout
      eyebrow={t("app.draw.three_step", { n: stage === "majors" ? "1" : "2" })}
      note={stage === "majors" ? t("app.draw.majors_label") : t("app.draw.minors_label")}
      title={stage === "majors" ? t("app.draw.majors_title") : t("app.draw.minors_title")}
      lede={stage === "majors" ? t("app.draw.majors_lede") : t("app.draw.minors_lede")}
      slots={POSITIONS.map((p, i) => ({ label: t(p), filled: selected[i] !== undefined }))}
      fan={deck ? <FanPicker key={stage} size={deck.size} selected={selected} limit={3} label={t(stage === "majors" ? "app.draw.fan_major" : "app.draw.fan_minor", { count: String(deck.size) })} onToggle={toggle} /> : null}
      footer={
        deck ? (
          <>
            <FormError message={error} />
            <button type="button" className="btn-gold lg:self-start lg:px-10" disabled={selected.length !== 3 || busy} onClick={() => void next()}>{stage === "majors" ? t("app.draw.next_clarifiers") : t("app.draw.turn_six")}</button>
            {majorsDeck ? <FingerprintText fingerprint={majorsDeck.fingerprint} label={t("app.draw.majors_fingerprint")} /> : null}
            {minorsDeck ? <FingerprintText fingerprint={minorsDeck.fingerprint} label={t("app.draw.minors_fingerprint")} /> : null}
            <p className="m-0 text-xs text-muted">{t("app.draw.three_note")}</p>
          </>
        ) : (
          <>
            <FormError message={error} />
            {error ? null : <p className="m-0 text-haze">{t("app.draw.shuffling")}</p>}
          </>
        )
      }
    />
  );
}
