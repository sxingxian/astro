"use client";

import { useState } from "react";
import { FormError } from "../FormError";
import { StepUpDialog } from "../StepUpDialog";
import { postJson } from "@/lib/client";

interface Facts {
  id: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  lastSignInAt: string | null;
  readingCount: number;
  disabledAt: string | null;
}

type Action = "disable" | "enable" | "reset-2fa";
const LABEL: Record<Action, string> = { disable: "Disable account", enable: "Enable account", "reset-2fa": "Reset 2-step sign-in" };
const QUESTION: Record<Action, string> = { disable: "Disable", enable: "Enable", "reset-2fa": "Reset 2-step sign-in for" };
const ERRORS: Record<string, string> = {
  staff_owner_only: "Only the owner can change a team member's account.",
  self: "You can't do this to your own account.",
  not_found: "That account no longer exists.",
  forbidden: "Your role doesn't allow this."
};
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function UsersClient() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts | null | undefined>(undefined);
  const [pending, setPending] = useState<Action | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ user: Facts | null }>("/api/users/find", { email });
    setBusy(false);
    if (!res.ok) return setError(res.status === 400 ? "Enter the person's full email address." : "Something went wrong. Please try again.");
    setFacts(res.data.user);
  }

  async function confirm(code: string): Promise<string | null> {
    if (!facts || !pending) return null;
    const res = await postJson<{ user: Facts | null }>(`/api/users/${pending}`, { userId: facts.id, code });
    if (!res.ok) return res.data.error ?? "server_error";
    setFacts(res.data.user);
    setPending(null);
    return null;
  }

  return (
    <div className="flex flex-col gap-5 max-w-[960px]">
      <form onSubmit={find} className="flex flex-wrap gap-3 items-end" noValidate>
        <label className="field flex-[1_1_360px]">
          Email address
          <input className="input" type="email" autoComplete="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
        </label>
        <button type="submit" className="btn btn-gold" disabled={busy}>Find</button>
      </form>
      <FormError message={error} />
      {facts === null ? <p className="m-0 text-sm text-muted">No account has that exact email.</p> : null}
      {facts ? (
        <section className="panel p-5 flex flex-col gap-4" aria-label={facts.email}>
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <h2 className="m-0 text-base font-semibold break-all">{facts.email}</h2>
            <span className={`inline-flex items-center min-h-[28px] px-3 rounded-full border text-[13px] ${facts.disabledAt ? "border-[rgba(226,109,109,.5)] text-[#F0A0A0]" : "border-[rgba(127,200,160,.5)] text-ok"}`}>
              {facts.disabledAt ? "Disabled" : "Active"}
            </span>
          </div>
          <dl className="m-0 grid gap-3 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            {[
              ["Joined", date(facts.createdAt)],
              ["Email confirmed", facts.emailVerified ? "Yes" : "No"],
              ["2-step sign-in", facts.twoFactorEnabled ? "On" : "Off"],
              ["Last sign-in", facts.lastSignInAt ? dateTime(facts.lastSignInAt) : "Not signed in"],
              ["Readings", String(facts.readingCount)]
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 p-3 rounded-xl border border-gold/12">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="m-0 text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2.5">
            {facts.twoFactorEnabled ? <button type="button" className="btn" onClick={() => setPending("reset-2fa")}>{LABEL["reset-2fa"]}</button> : null}
            {facts.disabledAt ? (
              <button type="button" className="btn" onClick={() => setPending("enable")}>{LABEL.enable}</button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => setPending("disable")}>{LABEL.disable}</button>
            )}
          </div>
          <p className="m-0 text-[13px] text-muted leading-relaxed">
            Journal notes, check-in notes and what readings said stay private and are never shown here. Disabling signs the person out everywhere and stops sign-in until re-enabled.
          </p>
        </section>
      ) : null}
      <StepUpDialog
        open={pending !== null}
        description={pending && facts ? <>{QUESTION[pending]} <span className="text-moon">{facts.email}</span>? Enter the code from your authenticator app to continue.</> : ""}
        confirmLabel={pending ? LABEL[pending] : ""}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
        messages={ERRORS}
      />
    </div>
  );
}
