"use client";

import { useRef, useState } from "react";
import type { AppKey } from "@astro/copy";
import { passwordHint } from "@astro/app-core/password";
import { useT } from "./CopyProvider";

/**
 * A new password typed twice, with the strength hint on the first field. "The passwords don't match." shows while
 * typing in the second field once it's as long as the first, or on submit; never on leaving the field, because a
 * message appearing then shifts the page under the pointer and the next click misses. Used by sign-up, the reset link
 * and Account → Change password, so all three behave the same.
 */
export function useNewPassword({ label, confirmLabel, id }: { label: AppKey; confirmLabel: AppKey; id: string }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checking, setChecking] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);
  const hint = passwordHint(password);
  const mismatch = (checking || (confirm.length > 0 && confirm.length >= password.length)) && confirm !== password;

  const fields = (
    <>
      <div className="field">
        <label htmlFor={id}>{t(label)}</label>
        <input id={id} type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={`${id}-hint`} />
        <p id={`${id}-hint`} className={`m-0 text-sm ${hint.ok ? "text-gold" : "text-muted"}`}>{t(hint.key, hint.values)}</p>
      </div>
      <div className="field">
        <label htmlFor={`${id}-confirm`}>{t(confirmLabel)}</label>
        <input
          ref={confirmRef}
          id={`${id}-confirm`}
          type="password"
          autoComplete="new-password"
          required
          maxLength={128}
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? `${id}-mismatch` : undefined}
        />
        {mismatch ? <p id={`${id}-mismatch`} className="error-text m-0 text-sm">{t("app.common.passwords_differ")}</p> : null}
      </div>
    </>
  );

  /** Call on submit. False (and the second field focused) if the two don't match. */
  function matches(): boolean {
    setChecking(true);
    if (confirm === password) return true;
    confirmRef.current?.focus();
    return false;
  }

  return { password, fields, matches, reset: () => (setPassword(""), setConfirm(""), setChecking(false)) };
}
