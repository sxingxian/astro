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
  staffRole: string | null;
  reader: boolean;
}

type Action = "disable" | "enable" | "reset-2fa";
const LABEL: Record<Action, string> = { disable: "Disable account", enable: "Enable account", "reset-2fa": "Reset 2-step sign-in" };
const QUESTION: Record<Action, string> = { disable: "Disable", enable: "Enable", "reset-2fa": "Reset 2-step sign-in for" };
const ERRORS: Record<string, string> = {
  staff_owner_only: "Only the owner can change a team member's account.",
  self: "You can't do this to your own account.",
  not_found: "That account no longer exists.",
  forbidden: "Your role doesn't allow this.",
  forbidden_role: "Your role can't offer that. Only the owner gives staff the reader role.",
  has_role: "They already have that role."
};
const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator" };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function UsersClient({ me, offerable }: { me: { id: string; role: string }; offerable: ("moderator" | "admin")[] }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts | null | undefined>(undefined);
  const [pending, setPending] = useState<Action | null>(null);
  const [offering, setOffering] = useState(false);
  const [offer, setOffer] = useState<{ reader: boolean; portalRole: "" | "moderator" | "admin" }>({ reader: true, portalRole: "" });
  const [offerAsk, setOfferAsk] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canOffer = me.role === "owner" || me.role === "admin";

  async function sendOffer(code: string): Promise<string | null> {
    if (!facts) return null;
    const res = await postJson("/api/readers/offer", { userId: facts.id, reader: offer.reader, portalRole: offer.portalRole || null, code });
    if (!res.ok) return res.data.error ?? "server_error";
    setOfferAsk(false);
    setOffering(false);
    setNotice(`Offer sent to ${facts.email}. It's listed on Team and roles until they accept.`);
    return null;
  }

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ user: Facts | null }>("/api/users/find", { email });
    setBusy(false);
    if (!res.ok) return setError(res.status === 400 ? "Enter the person's full email address." : "Something went wrong. Please try again.");
    setFacts(res.data.user);
    setOffering(false);
    setNotice(null);
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
              ["Readings", String(facts.readingCount)],
              ["Roles", [facts.staffRole ? ROLE_LABEL[facts.staffRole] : null, facts.reader ? "Reader" : null].filter(Boolean).join(" + ") || "None"]
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
            {canOffer && facts.id !== me.id && !facts.disabledAt ? <button type="button" className="btn" aria-expanded={offering} onClick={() => setOffering((o) => !o)}>Offer a role</button> : null}
          </div>
          {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
          {offering ? (
            <form
              className="flex flex-col gap-3 p-4 rounded-xl bg-deep border border-gold/20"
              aria-label="Offer a role"
              onSubmit={(e) => {
                e.preventDefault();
                if (offer.reader || offer.portalRole) setOfferAsk(true);
              }}
            >
              <label className="field">
                Portal role
                <select className="input" value={offer.portalRole} onChange={(e) => setOffer({ ...offer, portalRole: e.target.value as typeof offer.portalRole })}>
                  <option value="">None (reader only)</option>
                  {offerable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </label>
              <label className="flex gap-2.5 items-start text-sm leading-snug">
                <input type="checkbox" checked={offer.reader} onChange={(e) => setOffer({ ...offer, reader: e.target.checked })} className="w-[18px] h-[18px] mt-0.5 accent-gold flex-none" />
                Reader: answers questions and keeps a private log in the app
              </label>
              <div className="flex gap-2.5 flex-wrap">
                <button type="submit" className="btn btn-gold" disabled={!offer.reader && !offer.portalRole}>Send offer</button>
                <button type="button" className="btn" onClick={() => setOffering(false)}>Cancel</button>
              </div>
              <p className="m-0 text-[13px] text-muted leading-relaxed">They get an email with a link. Nothing changes until they accept in the app and turn on an authenticator.</p>
            </form>
          ) : null}
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
      <StepUpDialog
        open={offerAsk}
        description={facts ? <>Offer {[offer.portalRole ? ROLE_LABEL[offer.portalRole]?.toLowerCase() : null, offer.reader ? "reader" : null].filter(Boolean).join(" + ")} to <span className="text-moon">{facts.email}</span>?</> : ""}
        confirmLabel="Send offer"
        onConfirm={sendOffer}
        onCancel={() => setOfferAsk(false)}
        messages={ERRORS}
      />
    </div>
  );
}
