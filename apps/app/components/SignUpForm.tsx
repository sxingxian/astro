"use client";

import { useCallback, useState } from "react";
import { AuthShell, CheckEmail, FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { useNewPassword } from "./NewPassword";
import { Turnstile } from "./Turnstile";
import { localTimeZone, postJson } from "@/lib/client";
import { afterSignIn } from "@/lib/invite-client";

export function SignUpForm({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
  const t = useT();
  const { password, fields, matches } = useNewPassword({ label: "app.sign_up.password", confirmLabel: "app.sign_up.confirm_password", id: "password" });
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const onToken = useCallback((tok: string) => setToken(tok), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!matches()) return setError(null);
    if (mode === "on" && !token) return setError(t("app.common.complete_check"));
    setBusy(true);
    setError(null);
    const res = await postJson("/api/auth/sign-up/email", { email, password, name: email.split("@")[0]?.slice(0, 40) || "Friend", timeZone: localTimeZone(), callbackURL: afterSignIn() }, token ? { "x-captcha-response": token } : {});
    setBusy(false);
    if (res.ok) return setSent(true);
    if (res.status === 429) return setError(t("app.common.too_many"));
    if (res.status === 400 || res.status === 422) return setError(res.data.message ?? t("app.sign_up.check_input"));
    if (res.status === 403) return setError(t("app.common.check_failed"));
    setError(t("app.common.went_wrong"));
  }

  if (sent) return <CheckEmail title={t("app.common.check_email_title")} lede={t("app.sign_up.sent")} note={t("app.common.check_email_note")} back={t("app.common.back_to_sign_in")} />;

  // The page is this component, so after sending it can show only "Check your email" (one heading, one logo).
  return (
    <AuthShell
      title={t("app.sign_up.title")}
      lede={t("app.sign_up.lede")}
      footer={
        <div className="flex flex-col gap-3">
          <span>{t("app.sign_up.have_account")} <a href="/sign-in">{t("app.sign_up.sign_in_link")}</a></span>
          <span className="text-muted">{t("app.sign_up.footer_note")}</span>
        </div>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate={false}>
        <div className="field">
          <label htmlFor="email">{t("app.common.email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
        </div>
        {fields}
        <Turnstile mode={mode} siteKey={siteKey} action="sign-up" onToken={onToken} />
        <label className="flex items-start gap-3 text-sm leading-relaxed text-haze">
          <input type="checkbox" name="terms" required className="mt-0.5 size-5 flex-none accent-gold" />
          <span>
            {t("app.sign_up.agree_before")} <a href="https://astro.midnightpoetry.studio/terms">{t("app.sign_up.agree_terms")}</a> {t("app.sign_up.agree_and")}{" "}
            <a href="https://astro.midnightpoetry.studio/privacy">{t("app.sign_up.agree_privacy")}</a>.
          </span>
        </label>
        <FormError message={error} />
        <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? t("app.sign_up.button_busy") : t("app.sign_up.button")}</button>
      </form>
    </AuthShell>
  );
}
