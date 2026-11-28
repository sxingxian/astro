"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { useT } from "../CopyProvider";
import { useNewPassword } from "../NewPassword";
import { postJson } from "@/lib/client";

function useAction() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const msg = await fn();
      if (msg) setNote(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("app.account.went_wrong"));
    }
    setBusy(false);
  };
  return { busy, error, note, run };
}

export function ChangePassword() {
  const t = useT();
  const { busy, error, note, run } = useAction();
  const [open, setOpen] = useState(false);
  const next = useNewPassword({ label: "app.common.new_password", confirmLabel: "app.common.confirm_new_password", id: "pw-next" });
  if (!open)
    return (
      <div className="flex flex-col gap-2">
        {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>{t("app.account.change_password")}</button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!next.matches()) return;
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void run(async () => {
          const res = await postJson("/api/account/password", { currentPassword: f.get("current"), newPassword: next.password });
          if (!res.ok) throw new Error(res.status === 400 || res.status === 401 ? res.data.message ?? t("app.account.password_rule") : t("app.account.went_wrong"));
          form.reset();
          next.reset();
          setOpen(false);
          return t("app.account.password_changed");
        });
      }}
    >
      <div className="field"><label htmlFor="pw-current">{t("app.account.current_password")}</label><input id="pw-current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      {next.fields}
      <FormError message={error} />
      {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
      <div className="actions">
        <button type="submit" className="btn-gold" disabled={busy}>{t("app.account.save_password")}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("app.account.cancel")}</button>
      </div>
    </form>
  );
}

export function RevokeSession({ sessionId, device }: { sessionId: string; device: string }) {
  const t = useT();
  const { busy, error, run } = useAction();
  const [gone, setGone] = useState(false);
  if (gone) return <span className="text-sm text-muted">{t("app.account.signed_out")}</span>;
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" aria-label={t("app.account.sign_out_device", { device })} className="btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => void run(async () => {
        const res = await postJson("/api/account/sessions/revoke", { sessionId });
        if (!res.ok) throw new Error(t("app.account.sign_out_failed"));
        setGone(true);
      })}>{t("app.account.sign_out")}</button>
      <FormError message={error} />
    </span>
  );
}

export function TimeZoneForm({ current, zones }: { current: string; zones: string[] }) {
  const t = useT();
  const { busy, error, note, run } = useAction();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const timeZone = String(new FormData(e.currentTarget).get("tz"));
      void run(async () => {
        const res = await postJson<{ nextChange?: string }>("/api/account/time-zone", { timeZone });
        if (res.status === 429) throw new Error(t("app.account.tz_next", { date: new Date(res.data.nextChange ?? "").toLocaleDateString() }));
        if (!res.ok) throw new Error(t("app.account.tz_failed"));
        return t("app.account.saved");
      });
    }}>
      <div className="field">
        <label htmlFor="tz">{t("app.account.tz")}</label>
        <select id="tz" name="tz" defaultValue={current} className="input">{zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}</select>
        <p className="m-0 text-sm text-muted">{t("app.account.tz_hint")}</p>
      </div>
      <FormError message={error} />
      {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
      <button type="submit" className="btn-ghost" disabled={busy}>{t("app.account.tz_save")}</button>
    </form>
  );
}

export function CheckInsToggle({ enabled: initial }: { enabled: boolean }) {
  const t = useT();
  const [enabled, setEnabled] = useState(initial);
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span>{t("app.account.check_ins")}<span className="block text-sm text-muted">{t("app.account.check_ins_sub")}</span></span>
        <input type="checkbox" role="switch" checked={enabled} disabled={busy} className="size-6 accent-gold" onChange={(e) => {
          const next = e.target.checked;
          void run(async () => {
            const res = await postJson("/api/account/check-ins", { enabled: next });
            if (!res.ok) throw new Error(t("app.account.save_failed"));
            setEnabled(next);
          });
        }} />
      </label>
      <FormError message={error} />
    </div>
  );
}

export function SignOutButton() {
  const t = useT();
  return (
    <button type="button" className="btn-ghost" onClick={async () => {
      await postJson("/api/auth/sign-out", {});
      window.location.assign("/sign-in");
    }}>{t("app.account.sign_out")}</button>
  );
}

/** A reader giving up their own role. Their log is locked, not deleted. */
export function GiveUpReader() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>{t("app.account.give_up")}</button>;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-relaxed text-haze">{t("app.account.give_up_warning")}</p>
      <FormError message={error} />
      <div className="actions">
        <button type="button" className="btn-gold" disabled={busy} onClick={() => void run(async () => {
          const res = await postJson("/api/reader/give-up", {});
          if (!res.ok) throw new Error(t("app.common.went_wrong"));
          window.location.assign("/account");
        })}>{t("app.account.give_up_confirm")}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("app.account.cancel")}</button>
      </div>
    </div>
  );
}

export function DeleteAccount() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  if (!open) return <button type="button" className="btn-ghost border-error/60 text-error" onClick={() => setOpen(true)}>{t("app.account.delete")}</button>;
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void run(async () => {
        const res = await postJson("/api/account/delete", { password: f.get("password"), confirm: f.get("confirm") });
        if (!res.ok) throw new Error(res.status === 400 ? t("app.account.delete_rule") : t("app.account.delete_wrong_password"));
        window.location.assign("/sign-up");
      });
    }}>
      <p className="m-0 text-sm leading-relaxed text-haze">{t("app.account.delete_warning")}</p>
      <div className="field"><label htmlFor="del-password">{t("app.account.current_password")}</label><input id="del-password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      <div className="field"><label htmlFor="del-confirm">{t("app.account.delete_confirm")}</label><input id="del-confirm" name="confirm" required pattern="DELETE" className="input" /></div>
      <FormError message={error} />
      <div className="actions">
        <button type="submit" className="btn-gold bg-error" disabled={busy}>{t("app.account.delete_button")}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("app.account.cancel")}</button>
      </div>
    </form>
  );
}
