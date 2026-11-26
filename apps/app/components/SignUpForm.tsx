"use client";

import { useCallback, useState } from "react";
import { CheckEmail, FormError } from "./AuthShell";
import { Turnstile } from "./Turnstile";
import { localTimeZone, postJson } from "@/lib/client";
import { afterSignIn } from "@/lib/invite-client";
import { passwordHint } from "@/lib/password";

export function SignUpForm({ mode, siteKey }: { mode: "on" | "off"; siteKey: string }) {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const onToken = useCallback((t: string) => setToken(t), []);
  const hint = passwordHint(password);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (mode === "on" && !token) return setError("Please complete the check above.");
    setBusy(true);
    setError(null);
    const res = await postJson("/api/auth/sign-up/email", { email, password, name: email.split("@")[0]?.slice(0, 40) || "Friend", timeZone: localTimeZone(), callbackURL: afterSignIn() }, token ? { "x-captcha-response": token } : {});
    setBusy(false);
    if (res.ok) return setSent(true);
    if (res.status === 429) return setError("Too many attempts. Please wait a minute and try again.");
    if (res.status === 400 || res.status === 422) return setError(res.data.message ?? "Please check your email and password.");
    if (res.status === 403) return setError("Verification failed, try again.");
    setError("Something went wrong. Please try again.");
  }

  if (sent) return <CheckEmail lede="We've sent a link to confirm your email address. Open it to finish creating your account." />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate={false}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
        <p id="pw-hint" className={`m-0 text-sm ${hint.ok ? "text-gold" : "text-muted"}`}>{hint.label}</p>
      </div>
      <Turnstile mode={mode} siteKey={siteKey} action="sign-up" onToken={onToken} />
      <label className="flex items-start gap-3 text-sm leading-relaxed text-haze">
        <input type="checkbox" name="terms" required className="mt-0.5 size-5 flex-none accent-gold" />
        <span>I agree to the <a href="https://astro.midnightpoetry.studio/terms">Terms</a> and <a href="https://astro.midnightpoetry.studio/privacy">Privacy notice</a>.</span>
      </label>
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
