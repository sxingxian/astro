"use client";

import { useCallback, useState } from "react";
import { AuthShell, CheckEmail, FormError } from "./AuthShell";
import { Turnstile } from "./Turnstile";
import { postJson } from "@/lib/client";

export function ForgotForm({
  mode,
  siteKey,
}: {
  mode: "on" | "off";
  siteKey: string;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const onToken = useCallback((t: string) => setToken(t), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (mode === "on" && !token)
      return setError("Please complete the check above.");
    setBusy(true);
    setError(null);
    const res = await postJson(
      "/api/auth/request-password-reset",
      {
        email: String(form.get("email") ?? "").trim(),
        redirectTo: "/reset-password",
      },
      token ? { "x-captcha-response": token } : {},
    );
    setBusy(false);
    if (res.ok) return setSent(true);
    if (res.status === 429)
      return setError("Too many attempts. Please wait a minute and try again.");
    setError("Something went wrong. Please try again.");
  }

  if (sent)
    return (
      <CheckEmail lede="If an account uses that email, we've sent a link to reset its password." />
    );
  return (
    <AuthShell
      title="Reset your password"
      lede="Enter your email and we'll send you a link to choose a new password."
      footer={<a href="/sign-in">Back to sign in</a>}
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="input"
          />
        </div>
        <Turnstile
          mode={mode}
          siteKey={siteKey}
          action="reset"
          onToken={onToken}
        />
        <FormError message={error} />
        <button type="submit" className="btn-gold w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
