"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { postJson } from "@/lib/client";

type Step = "idle" | "password" | "scan" | "codes" | "disable";

export function TwoStepSetup({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ totpURI: string; qr: string; secret: string; backupCodes: string[] } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    await fn();
    setBusy(false);
  };

  const start = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    void run(async () => {
      const res = await postJson<{ totpURI: string; qr: string; secret: string; backupCodes: string[] }>("/api/account/two-step/enable", { password });
      if (!res.ok) return setError(res.status === 400 || res.status === 401 ? "That password isn't right." : "Something went wrong. Please try again.");
      setSetup(res.data);
      setStep("scan");
    });
  };

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    void run(async () => {
      const res = await postJson("/api/auth/two-factor/verify-totp", { code });
      if (!res.ok) return setError("That code didn't match. Check the time on your phone and try again.");
      setStep("codes");
    });
  };

  const disable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    void run(async () => {
      const res = await postJson("/api/account/two-step/disable", { password });
      if (!res.ok) return setError(res.status === 400 || res.status === 401 ? "That password isn't right." : "Something went wrong. Please try again.");
      setEnabled(false);
      setStep("idle");
    });
  };

  if (step === "password" || step === "disable")
    return (
      <form onSubmit={step === "password" ? start : disable} className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="tfa-password">Current password</label>
          <input id="tfa-password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <FormError message={error} />
        <div className="flex gap-3">
          <button type="submit" className="btn-gold flex-1" disabled={busy}>{step === "password" ? "Continue" : "Turn off"}</button>
          <button type="button" className="btn-ghost" onClick={() => { setStep("idle"); setError(null); }}>Cancel</button>
        </div>
      </form>
    );

  if (step === "scan" && setup)
    return (
      <form onSubmit={confirm} className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">Scan this with an authenticator app, then enter the 6-digit code it shows.</p>
        <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl" data-testid="totp-uri" data-uri={setup.totpURI} />
        <p className="m-0 text-sm text-muted">Can't scan? Enter this key: <code className="break-all text-moon">{setup.secret}</code></p>
        <div className="field">
          <label htmlFor="tfa-code">6-digit code</label>
          <input id="tfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} className="input tracking-[0.3em]" />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn-gold" disabled={busy}>Confirm</button>
      </form>
    );

  if (step === "codes" && setup)
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">Save these backup codes somewhere safe. Each one works once if you lose your phone. They won't be shown again.</p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 font-mono text-sm">
          {setup.backupCodes.map((c) => <li key={c} data-testid="backup-code" className="rounded-lg border border-gold/20 px-3 py-2">{c}</li>)}
        </ul>
        <button type="button" className="btn-gold" onClick={() => { setEnabled(true); setStep("idle"); setSetup(null); }}>I've saved them</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-relaxed text-haze">{enabled ? "2-step sign-in is on." : "2-step sign-in is off."} {enabled ? "You'll be asked for a code from your authenticator app when you sign in." : "Add a code from an authenticator app when you sign in. You'll get 10 one-time backup codes in case you lose your phone."}</p>
      {enabled ? (
        <button type="button" className="btn-ghost" onClick={() => setStep("disable")}>Turn off 2-step sign-in</button>
      ) : (
        <button type="button" className="btn-gold" onClick={() => setStep("password")}>Turn on 2-step sign-in</button>
      )}
    </div>
  );
}
