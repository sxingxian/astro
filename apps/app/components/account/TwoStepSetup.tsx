"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { useT } from "../CopyProvider";
import { postJson } from "@/lib/client";

type Step = "idle" | "password" | "scan" | "codes" | "disable";

export function TwoStepSetup({ enabled: initial }: { enabled: boolean }) {
  const t = useT();
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
      if (!res.ok) return setError(res.status === 400 || res.status === 401 ? t("app.tfa.wrong_password") : t("app.common.went_wrong"));
      setSetup(res.data);
      setStep("scan");
    });
  };

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    void run(async () => {
      const res = await postJson("/api/auth/two-factor/verify-totp", { code });
      if (!res.ok) return setError(t("app.tfa.code_wrong"));
      setStep("codes");
    });
  };

  const disable = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    void run(async () => {
      const res = await postJson("/api/account/two-step/disable", { password });
      if (!res.ok) return setError(res.status === 400 || res.status === 401 ? t("app.tfa.wrong_password") : t("app.common.went_wrong"));
      setEnabled(false);
      setStep("idle");
    });
  };

  if (step === "password" || step === "disable")
    return (
      <form onSubmit={step === "password" ? start : disable} className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="tfa-password">{t("app.account.current_password")}</label>
          <input id="tfa-password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <FormError message={error} />
        <div className="flex gap-3">
          <button type="submit" className="btn-gold flex-1" disabled={busy}>{step === "password" ? t("app.tfa.continue") : t("app.tfa.turn_off_button")}</button>
          <button type="button" className="btn-ghost" onClick={() => { setStep("idle"); setError(null); }}>{t("app.account.cancel")}</button>
        </div>
      </form>
    );

  if (step === "scan" && setup)
    return (
      <form onSubmit={confirm} className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.tfa.scan")}</p>
        <img src={setup.qr} alt={t("app.tfa.qr_alt")} width={180} height={180} className="rounded-xl" data-testid="totp-uri" data-uri={setup.totpURI} />
        <p className="m-0 text-sm text-muted">{t("app.tfa.cant_scan")} <code className="break-all text-moon">{setup.secret}</code></p>
        <div className="field">
          <label htmlFor="tfa-code">{t("app.tfa.code")}</label>
          <input id="tfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} className="input tracking-[0.3em]" />
        </div>
        <FormError message={error} />
        <button type="submit" className="btn-gold" disabled={busy}>{t("app.tfa.confirm")}</button>
      </form>
    );

  if (step === "codes" && setup)
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.tfa.backup_intro")}</p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 font-mono text-sm">
          {setup.backupCodes.map((c) => <li key={c} data-testid="backup-code" className="rounded-lg border border-gold/20 px-3 py-2">{c}</li>)}
        </ul>
        <button type="button" className="btn-gold" onClick={() => { setEnabled(true); setStep("idle"); setSetup(null); }}>{t("app.tfa.saved")}</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-relaxed text-haze">{enabled ? t("app.tfa.on") : t("app.tfa.off")} {enabled ? t("app.tfa.on_detail") : t("app.tfa.off_detail")}</p>
      {enabled ? (
        <button type="button" className="btn-ghost" onClick={() => setStep("disable")}>{t("app.tfa.turn_off")}</button>
      ) : (
        <button type="button" className="btn-gold" onClick={() => setStep("password")}>{t("app.tfa.turn_on")}</button>
      )}
    </div>
  );
}
