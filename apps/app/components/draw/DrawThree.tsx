"use client";

import { useCallback, useEffect, useState } from "react";
import { FormError } from "../AuthShell";
import { Fan } from "./Fan";
import { FingerprintText } from "./FingerprintText";
import { pickCards, startReading, type StartState } from "@/lib/draw/client";

const POSITIONS = ["Past", "Present", "Future"];

export function DrawThree() {
  const [state, setState] = useState<StartState | null>(null);
  const [stage, setStage] = useState<"majors" | "minors">("majors");
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    const out = await startReading("three");
    if (out.kind === "done") return window.location.replace(`/reading/${out.sessionId}`);
    if (out.kind === "sign-up") return window.location.replace("/sign-up");
    if (out.kind === "error" || out.kind === "needs-check") return setError(out.kind === "error" ? out.message : "Please sign in to draw three pairs.");
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
    if (!ok) return setError("That didn't go through. Please try again.");
    if (stage === "majors") { setStage("minors"); setSelected([]); return; }
    window.location.assign(`/reading/${state.sessionId}`);
  }

  const majorsDeck = state?.decks.find((d) => d.stage === "majors");
  const minorsDeck = state?.decks.find((d) => d.stage === "minors");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 px-5">
        <p className="eyebrow">Three pairs · Step {stage === "majors" ? 1 : 2} of 2</p>
        <p className="m-0 text-sm text-muted">{stage === "majors" ? "Major Arcana · 22 cards" : "Minor Arcana · 56 cards"}</p>
        <h1 className="m-0 font-display text-4xl font-medium leading-tight">{stage === "majors" ? "Choose three for your themes" : "Now choose three clarifiers"}</h1>
        <p className="m-0 text-haze">{stage === "majors" ? "They'll be placed in order: past, present, future." : "How each theme shows up in your everyday life."}</p>
      </div>
      {deck ? (
        <>
          <Fan key={stage} size={deck.size} selected={selected} limit={3} label={`Shuffled ${stage === "majors" ? "Major" : "Minor"} Arcana, ${deck.size} cards face down`} onToggle={toggle} />
          <div className="flex flex-col gap-3 px-5">
            <ol className="m-0 flex list-none gap-2 p-0" aria-live="polite">
              {POSITIONS.map((p, i) => (
                <li key={p} className={`flex-1 rounded-full border px-3 py-2 text-center text-sm ${selected[i] !== undefined ? "border-gold text-moon" : "border-gold/20 text-muted"}`}>{p}{selected[i] !== undefined ? " ✓" : ""}</li>
              ))}
            </ol>
            <FormError message={error} />
            <button type="button" className="btn-gold" disabled={selected.length !== 3 || busy} onClick={() => void next()}>{stage === "majors" ? "Next: choose clarifiers" : "Turn all six cards"}</button>
            {majorsDeck ? <FingerprintText fingerprint={majorsDeck.fingerprint} label="Majors fingerprint" /> : null}
            {minorsDeck ? <FingerprintText fingerprint={minorsDeck.fingerprint} label="Minors fingerprint" /> : null}
            <p className="m-0 text-xs text-muted">Both decks were shuffled before you chose, separately, so no card can repeat. You can check them after the reading.</p>
          </div>
        </>
      ) : (
        <div className="px-5"><FormError message={error} />{error ? null : <p className="m-0 text-haze">Shuffling…</p>}</div>
      )}
    </div>
  );
}
