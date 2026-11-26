"use client";

import { useState } from "react";
import { FormError } from "./FormError";
import { BASE, postJson } from "@/lib/client";

type Setup = { totpURI: string; qr: string; secret: string; backupCodes: string[] };

/** Required 2-step setup for staff: password, scan, confirm a code, save the backup codes. */
export function SetupTwoStep() {
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await postJson<Setup>("/api/setup-2fa", { password });
      if (res.status === 429) return setError("Too many attempts. Please wait 15 minutes and try again.");
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

  if (step === "scan" && setup)
    return (
      <form onSubmit={confirm} className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">Scan this with an authenticator app (Google Authenticator, 1Password, Authy or similar), then enter the 6-digit code it shows.</p>
        <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl self-center" data-testid="totp-uri" data-uri={setup.totpURI} />
        <p className="m-0 text-sm text-muted">Can&apos;t scan? Enter this key: <code className="break-all text-moon">{setup.secret}</code></p>
        <div className="field">
          <label htmlFor="tfa-code">6-digit code</label>
          <input id="tfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} className="input text-center text-2xl tracking-[0.3em]" />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn btn-gold" disabled={busy}>Confirm</button>
      </form>
    );

  if (step === "codes" && setup)
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">Save these backup codes somewhere safe, such as your password manager. Each one works once if you lose your phone. They won&apos;t be shown again.</p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 font-mono text-sm">
          {setup.backupCodes.map((c) => <li key={c} data-testid="backup-code" className="rounded-lg border border-gold/20 px-3 py-2">{c}</li>)}
        </ul>
        <button type="button" className="btn btn-gold" onClick={() => window.location.assign(BASE)}>I&apos;ve saved them</button>
      </div>
    );

  return (
    <form onSubmit={start} className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="tfa-password">Current password</label>
        <input id="tfa-password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="input" />
      </div>
      <FormError message={error} />
      <button type="submit" className="btn btn-gold" disabled={busy}>Continue</button>
    </form>
  );
}
