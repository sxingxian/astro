"use client";

import { useEffect, useRef, useState } from "react";
import { FormError } from "./FormError";

const MESSAGES: Record<string, string> = {
  step_up_wrong_code: "That code didn't match. Check your authenticator app and try again.",
  step_up_replayed: "That code has been used already. Wait for the next one.",
  step_up_too_many: "Too many wrong codes. Please wait 15 minutes and try again.",
  step_up_no_authenticator: "Your account has no authenticator. Sign out and sign in again."
};

/** "Confirm it's you": asks for a fresh authenticator code before a sensitive action. */
export function StepUpDialog({
  open,
  title = "Confirm it's you",
  description,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title?: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** Returns an error code from the server, or null on success. */
  onConfirm: (code: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    const err = await onConfirm(code);
    setBusy(false);
    if (err) setError(MESSAGES[err] ?? "Something went wrong. Please try again.");
  }

  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="stepup-title" className="panel m-auto w-[min(440px,calc(100%-32px))] p-7 text-moon backdrop:bg-night/75">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 id="stepup-title" className="serif text-[30px] font-semibold m-0">{title}</h2>
        <div className="m-0 text-sm text-haze leading-relaxed">{description}</div>
        <div className="field">
          <label htmlFor="stepup-code">6-digit code</label>
          <input id="stepup-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} autoFocus className="input text-center text-2xl tracking-[0.3em]" />
        </div>
        <FormError message={error} />
        <div className="flex gap-2.5 justify-end">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? "Checking…" : confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
