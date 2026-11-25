"use client";

import { useState } from "react";
import { FormError } from "./AuthShell";
import { postJson } from "@/lib/client";

export function TwoStepChallenge() {
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    setError(null);
    const res = await postJson(backup ? "/api/auth/two-factor/verify-backup-code" : "/api/auth/two-factor/verify-totp", { code, trustDevice: false });
    setBusy(false);
    if (res.ok) return window.location.assign("/today");
    if (res.status === 429) return setError("Too many attempts. Please wait a minute and try again.");
    if (res.status === 401 && /session|cookie/i.test(res.data.message ?? "")) return setError("Your sign-in timed out. Please sign in again.");
    setError(backup ? "That backup code didn't match, or it has been used already." : "That code didn't match. Check your authenticator app and try again.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" key={backup ? "backup" : "totp"}>
      {backup ? (
        <div className="field">
          <label htmlFor="code">Backup code</label>
          <input id="code" name="code" autoComplete="one-time-code" required maxLength={32} className="input" />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="code">6-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} className="input tracking-[0.3em]" />
        </div>
      )}
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
      <button type="button" className="btn-ghost w-full" onClick={() => { setBackup(!backup); setError(null); }}>
        {backup ? "Use my authenticator app" : "Use a backup code"}
      </button>
    </form>
  );
}
