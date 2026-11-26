"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { postJson } from "@/lib/client";

function useAction() {
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
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  };
  return { busy, error, note, run };
}

export function ChangePassword() {
  const { busy, error, note, run } = useAction();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="flex flex-col gap-2">
        {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Change password</button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void run(async () => {
          const res = await postJson("/api/account/password", { currentPassword: f.get("current"), newPassword: f.get("next") });
          if (!res.ok) throw new Error(res.status === 400 || res.status === 401 ? res.data.message ?? "Check your current password, and use at least 12 characters." : "Something went wrong.");
          form.reset();
          setOpen(false);
          return "Password changed. Other devices have been signed out.";
        });
      }}
    >
      <div className="field"><label htmlFor="pw-current">Current password</label><input id="pw-current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div className="field"><label htmlFor="pw-next">New password</label><input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="input" /></div>
      <FormError message={error} />
      {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
      <div className="flex gap-3">
        <button type="submit" className="btn-gold flex-1" disabled={busy}>Save new password</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function RevokeSession({ sessionId, device }: { sessionId: string; device: string }) {
  const { busy, error, run } = useAction();
  const [gone, setGone] = useState(false);
  if (gone) return <span className="text-sm text-muted">Signed out</span>;
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" aria-label={`Sign out ${device}`} className="btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => void run(async () => {
        const res = await postJson("/api/account/sessions/revoke", { sessionId });
        if (!res.ok) throw new Error("Couldn't sign that device out.");
        setGone(true);
      })}>Sign out</button>
      <FormError message={error} />
    </span>
  );
}

export function TimeZoneForm({ current, zones }: { current: string; zones: string[] }) {
  const { busy, error, note, run } = useAction();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const timeZone = String(new FormData(e.currentTarget).get("tz"));
      void run(async () => {
        const res = await postJson<{ nextChange?: string }>("/api/account/time-zone", { timeZone });
        if (res.status === 429) throw new Error(`You can change your time zone again on ${new Date(res.data.nextChange ?? "").toLocaleDateString()}.`);
        if (!res.ok) throw new Error("Couldn't save your time zone.");
        return "Saved.";
      });
    }}>
      <div className="field">
        <label htmlFor="tz">Time zone</label>
        <select id="tz" name="tz" defaultValue={current} className="input">{zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}</select>
        <p className="m-0 text-sm text-muted">Your daily reading resets at midnight here. You can change this once a week.</p>
      </div>
      <FormError message={error} />
      {note ? <p role="status" className="m-0 text-sm text-gold">{note}</p> : null}
      <button type="submit" className="btn-ghost" disabled={busy}>Save time zone</button>
    </form>
  );
}

export function CheckInsToggle({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span>7-day check-ins<span className="block text-sm text-muted">Ask how a reading turned out a week later.</span></span>
        <input type="checkbox" role="switch" checked={enabled} disabled={busy} className="size-6 accent-gold" onChange={(e) => {
          const next = e.target.checked;
          void run(async () => {
            const res = await postJson("/api/account/check-ins", { enabled: next });
            if (!res.ok) throw new Error("Couldn't save that.");
            setEnabled(next);
          });
        }} />
      </label>
      <FormError message={error} />
    </div>
  );
}

export function SignOutButton() {
  return (
    <button type="button" className="btn-ghost w-full" onClick={async () => {
      await postJson("/api/auth/sign-out", {});
      window.location.assign("/sign-in");
    }}>Sign out</button>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  if (!open) return <button type="button" className="btn-ghost border-error/60 text-error" onClick={() => setOpen(true)}>Delete account</button>;
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void run(async () => {
        const res = await postJson("/api/account/delete", { password: f.get("password"), confirm: f.get("confirm") });
        if (!res.ok) throw new Error(res.status === 400 ? "Type DELETE in capitals and check your password." : "That password isn't right.");
        window.location.assign("/sign-up");
      });
    }}>
      <p className="m-0 text-sm leading-relaxed text-haze">This permanently deletes your account, your readings, notes and check-ins. It can't be undone.</p>
      <div className="field"><label htmlFor="del-password">Current password</label><input id="del-password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      <div className="field"><label htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" name="confirm" required pattern="DELETE" className="input" /></div>
      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" className="btn-gold flex-1 bg-error" disabled={busy}>Delete everything</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
