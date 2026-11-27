"use client";

import { useCallback, useState } from "react";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { Turnstile } from "./Turnstile";
import { afterSignIn } from "@/lib/invite-client";
import { postJson } from "@/lib/client";

export function SignInForm({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
  const t = useT();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onToken = useCallback((t: string) => setToken(t), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (mode === "on" && !token) return setError(t("app.common.complete_check"));
    setBusy(true);
    setError(null);
    const res = await postJson<{ twoFactorRedirect?: boolean }>(
      "/api/auth/sign-in/email",
      { email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""), callbackURL: "/today" },
      token ? { "x-captcha-response": token } : {}
    );
    setBusy(false);
    if (res.ok && res.data.twoFactorRedirect) return window.location.assign("/two-step");
    if (res.ok) return window.location.assign(afterSignIn());
    if (res.status === 403 && res.data.code === "EMAIL_NOT_VERIFIED") return setError(t("app.sign_in.unverified"));
    if (res.status === 429) return setError(t("app.common.too_many"));
    if (res.status === 401) return setError(t("app.sign_in.wrong"));
    if (res.status === 403) return setError(t("app.common.check_failed"));
    setError(t("app.common.went_wrong"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="field">
        <label htmlFor="email">{t("app.common.email")}</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
      </div>
      <div className="field">
        <label htmlFor="password">{t("app.sign_in.password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="input" />
      </div>
      <Turnstile mode={mode} siteKey={siteKey} action="sign-in" onToken={onToken} />
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? t("app.sign_in.button_busy") : t("app.sign_in.button")}</button>
    </form>
  );
}
