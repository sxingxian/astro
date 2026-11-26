"use client";

import { useCallback, useState } from "react";
import { FormError } from "./AuthShell";
import { Turnstile } from "./Turnstile";
import { afterSignIn } from "@/lib/invite-client";
import { postJson } from "@/lib/client";

export function SignInForm({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
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
      { email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""), callbackURL: "/today" },
      token ? { "x-captcha-response": token } : {}
    );
    setBusy(false);
    if (res.ok && res.data.twoFactorRedirect) return window.location.assign("/two-step");
    if (res.ok) return window.location.assign(afterSignIn());
    if (res.status === 403 && res.data.code === "EMAIL_NOT_VERIFIED") return setError("Check your email to confirm your account. We've sent a new link.");
    if (res.status === 429) return setError("Too many attempts. Please wait a minute and try again.");
    if (res.status === 401) return setError("That email and password don't match.");
    if (res.status === 403) return setError("Verification failed, try again.");
    setError("Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="input" />
      </div>
      <Turnstile mode={mode} siteKey={siteKey} action="sign-in" onToken={onToken} />
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
