"use client";

import { useState } from "react";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { afterSignIn } from "@/lib/invite-client";
import { postJson } from "@/lib/client";

export function TwoStepChallenge() {
  const t = useT();
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
    if (res.ok) return window.location.assign(afterSignIn());
    if (res.status === 429) return setError(t("app.common.too_many"));
    if (res.status === 401 && /session|cookie/i.test(res.data.message ?? "")) return setError(t("app.two_step.timed_out"));
    setError(backup ? t("app.two_step.backup_wrong") : t("app.two_step.code_wrong"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" key={backup ? "backup" : "totp"}>
      {backup ? (
        <div className="field">
          <label htmlFor="code">{t("app.two_step.backup_code")}</label>
          <input id="code" name="code" autoComplete="one-time-code" required maxLength={32} className="input" />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="code">{t("app.two_step.code")}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} className="input tracking-[0.3em]" />
        </div>
      )}
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? t("app.two_step.verify_busy") : t("app.two_step.verify")}</button>
      <button type="button" className="btn-ghost w-full" onClick={() => { setBackup(!backup); setError(null); }}>
        {backup ? t("app.two_step.use_app") : t("app.two_step.use_backup")}
      </button>
    </form>
  );
}
