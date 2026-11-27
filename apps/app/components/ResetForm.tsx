"use client";

import { useState } from "react";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { useNewPassword } from "./NewPassword";
import { postJson } from "@/lib/client";

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const { password, fields, matches } = useNewPassword({ label: "app.common.new_password", confirmLabel: "app.common.confirm_new_password", id: "new-password" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matches()) return setError(null);
    setBusy(true);
    setError(null);
    const res = await postJson("/api/auth/reset-password", { newPassword: password, token });
    setBusy(false);
    if (res.ok) return setDone(true);
    if (res.status === 400 && /token/i.test(res.data.message ?? res.data.code ?? "")) return setError(t("app.reset.link_expired"));
    setError(res.data.message ?? t("app.common.went_wrong"));
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 font-display text-2xl">{t("app.reset.done_title")}</p>
        <p className="m-0 text-haze">{t("app.reset.done_text")}</p>
        <a className="btn-gold" href="/sign-in">{t("app.reset.done_button")}</a>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {fields}
      <FormError message={error} />
      <button type="submit" className="btn-gold w-full" disabled={busy}>{busy ? t("app.reset.button_busy") : t("app.reset.button")}</button>
    </form>
  );
}
