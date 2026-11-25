"use client";

import { useState } from "react";
import { FormError } from "./AuthShell";
import { postJson } from "@/lib/client";
import { passwordHint } from "@/lib/password";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hint = passwordHint(password);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson("/api/auth/reset-password", { newPassword: password, token });
    setBusy(false);
    if (res.ok) return setDone(true);
    if (res.status === 400 && /token/i.test(res.data.message ?? res.data.code ?? "")) return setError("This reset link has expired. Please request a new one.");
    setError(res.data.message ?? "Something went wrong. Please try again.");
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 font-display text-2xl">Password updated</p>
        <p className="m-0 text-haze">You've been signed out on every other device.</p>
        <a className="btn-gold" href="/sign-in">Sign in</a>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
        <p id="pw-hint" className={`m-0 text-sm ${hint.ok ? "text-gold" : "text-muted"}`}>{hint.label}</p>
      </div>
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
