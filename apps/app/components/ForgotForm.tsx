"use client";

import { useCallback, useState } from "react";
import { AuthShell, CheckEmail, FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { Turnstile } from "./Turnstile";
import { postJson } from "@/lib/client";

export function ForgotForm({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
  const t = useT();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const onToken = useCallback((tok: string) => setToken(tok), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (mode === "on" && !token) return setError(t("app.common.complete_check"));
    setBusy(true);
    setError(null);
    const res = await postJson("/api/auth/request-password-reset", { email: String(form.get("email") ?? "").trim(), redirectTo: "/reset-password" }, token ? { "x-captcha-response": token } : {});
    setBusy(false);
    if (res.ok) return setSent(true);
    if (res.status === 429) return setError(t("app.common.too_many"));
    setError(t("app.common.went_wrong"));
  }

  if (sent) return <CheckEmail title={t("app.common.check_email_title")} lede={t("app.forgot.sent")} note={t("app.common.check_email_note")} back={t("app.common.back_to_sign_in")} />;

  return (
    <AuthShell title={t("app.forgot.title")} lede={t("app.forgot.lede")} footer={<a href="/sign-in">{t("app.common.back_to_sign_in")}</a>}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="field">
          <label htmlFor="email">{t("app.common.email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
        </div>
        <Turnstile mode={mode} siteKey={siteKey} action="reset" onToken={onToken} />
        <FormError message={error} />
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? t("app.forgot.button_busy") : t("app.forgot.button")}</button>
      </form>
    </AuthShell>
  );
}
