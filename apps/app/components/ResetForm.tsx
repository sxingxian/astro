"use client";

import { useState } from "react";
import { FormError } from "./AuthShell";
import { useNewPassword } from "./NewPassword";
import { postJson } from "@/lib/client";

export function ResetForm({ token }: { token: string }) {
  const { password, fields, matches } = useNewPassword({ label: "New password", confirmLabel: "Confirm new password", id: "new-password" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matches()) return setError(null);
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
      {fields}
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
