"use client";

import { useCallback, useState } from "react";
import { FormError } from "./FormError";
import { Turnstile } from "./Turnstile";
import { BASE, postJson } from "@/lib/client";

export function SignInForm({ mode, siteKey, appUrl }: { mode: "on" | "off"; siteKey: string; appUrl: string }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onToken = useCallback((t: string) => setToken(t), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (mode === "on" && !token) return setError("Please complete the check above.");
    setBusy(true);
    setError(null);
    const res = await postJson<{ twoFactorRedirect?: boolean }>(
      "/api/auth/sign-in/email",
      { email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") },
      token ? { "x-captcha-response": token } : {}
    );
    setBusy(false);
    if (res.ok && res.data.twoFactorRedirect) return window.location.assign(`${BASE}/two-step`);
    if (res.ok) return window.location.assign(BASE);
    if (res.status === 401) return setError("That email or password isn't right.");
    if (res.status === 403 && res.data.code === "EMAIL_NOT_VERIFIED") return setError("Confirm your email first. We've sent you a new link.");
    if (res.status === 429) return setError("Too many attempts. Please wait a minute and try again.");
    setError("Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} className="input" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="input" />
      </div>
      <Turnstile mode={mode} siteKey={siteKey} action="admin-sign-in" onToken={onToken} />
      <FormError message={error} />
      <button type="submit" className="btn btn-gold w-full" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
      <a href={`${appUrl}/forgot-password`} className="text-sm self-start">Forgot your password?</a>
    </form>
  );
}
