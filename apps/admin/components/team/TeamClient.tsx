"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "../FormError";
import { StepUpDialog } from "../StepUpDialog";
import { postJson } from "@/lib/client";

type Role = "owner" | "admin" | "moderator" | "reader";
type StaffRole = Exclude<Role, "reader">;
type PortalOffer = "admin" | "moderator";

interface Member {
  userId: string;
  email: string;
  role: StaffRole | null;
  reader: boolean;
  formerReader: boolean;
  twoFactorEnabled: boolean;
  grantedAt: string;
  canManage: boolean;
  addReader: "self" | "offer" | null;
  canRemoveReader: boolean;
  canOfferAgain: boolean;
}
interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  canCancel: boolean;
}
interface Offer {
  id: string;
  email: string;
  reader: boolean;
  portalRole: PortalOffer | null;
  expiresAt: string;
  canWithdraw: boolean;
}

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", reader: "Reader" };

const MATRIX: [string, string, string, string, string][] = [
  ["Card meanings", "Edit", "View", "—", "View"],
  ["Other text, site settings", "Edit", "Edit", "—", "—"],
  ["AI services and keys", "Edit", "—", "—", "—"],
  ["Invite and remove people", "Everyone", "Moderators; readers who aren't staff", "—", "—"],
  ["Give staff the reader role", "Yes, themselves too", "—", "—", "—"],
  ["Help users (disable, reset 2-step)", "Yes", "Yes", "Yes", "—"],
  ["Reading requests (plan 4)", "All", "All", "All", "Own only"],
  ["Audit log", "View", "View", "—", "—"]
];

const ERRORS: Record<string, string> = {
  has_role: "That person already has that role.",
  forbidden_role: "Your role can't do that.",
  invalid_input: "Check the email address, and choose at least one role.",
  not_found: "No account has that exact email.",
  self: "You can't offer yourself a role."
};

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const expires = (iso: string) => `expires in ${daysLeft(iso)} ${daysLeft(iso) === 1 ? "day" : "days"}`;
const offerWords = (o: { reader: boolean; portalRole: PortalOffer | null }) => [o.portalRole ? ROLE_LABEL[o.portalRole] : null, o.reader ? "Reader" : null].filter(Boolean).join(" + ");

type Pending = { label: string; description: string; path: string; body: Record<string, unknown> };

const Badge = ({ kind, children }: { kind: "owner" | "role" | "none"; children: React.ReactNode }) => (
  <span className={`inline-flex items-center min-h-[26px] px-2.5 rounded-full text-xs font-semibold ${kind === "owner" ? "bg-gold text-night" : kind === "none" ? "border border-[rgba(140,136,166,.5)] text-muted" : "bg-nebula text-moon"}`}>{children}</span>
);

export function TeamClient({ me, grantable, offerable, members, invites, offers }: { me: { id: string; role: Role }; grantable: Role[]; offerable: PortalOffer[]; members: Member[]; invites: Invite[]; offers: Offer[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"invite" | "existing">("invite");

  async function confirm(code: string): Promise<string | null> {
    if (!pending) return null;
    const res = await postJson(pending.path, { ...pending.body, code });
    if (res.ok) {
      setPending(null);
      setNotice(`${pending.label}: done.`);
      router.refresh();
      return null;
    }
    if (res.data.error?.startsWith("step_up_")) return res.data.error;
    setPending(null);
    setFormError(ERRORS[res.data.error ?? ""] ?? "Something went wrong. Please try again.");
    return null;
  }

  function ask(p: Pending) {
    setFormError(null);
    setNotice(null);
    setPending(p);
  }

  function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const role = String(f.get("role") ?? "reader") as Role;
    ask({ label: "Invite sent", description: `Send an invitation to ${email} as ${ROLE_LABEL[role].toLowerCase()}?`, path: "/api/team/invite", body: { email, role } });
  }

  function offerExisting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const portal = String(f.get("portalRole") ?? "");
    const portalRole = portal === "admin" || portal === "moderator" ? portal : null;
    const reader = f.get("reader") === "on";
    if (!portalRole && !reader) return setFormError(ERRORS.invalid_input!);
    ask({ label: "Offer sent", description: `Offer ${offerWords({ reader, portalRole }).toLowerCase()} to ${email}? Nothing changes until they accept.`, path: "/api/readers/offer", body: { email, reader, portalRole } });
  }

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
        {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
        <section className="panel p-2" aria-labelledby="people-h">
          <h2 id="people-h" className="m-0 px-3 pt-3 pb-1 text-base font-semibold">People</h2>
          <div className="overflow-x-auto">
            <table className="grid min-w-[680px]">
              <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">2-step</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td>{m.email}{m.userId === me.id ? <><br /><span className="text-xs text-muted">You</span></> : null}</td>
                    <td>
                      <div className="flex gap-1.5 flex-wrap">
                        {m.role ? <Badge kind={m.role === "owner" ? "owner" : "role"}>{ROLE_LABEL[m.role]}</Badge> : null}
                        {m.reader ? <Badge kind="role">{m.role ? "+ Reader" : "Reader"}</Badge> : null}
                        {!m.role && !m.reader ? <Badge kind="none">No role</Badge> : null}
                      </div>
                    </td>
                    <td>{m.formerReader ? "Reader log locked" : "Active"}</td>
                    <td className={m.twoFactorEnabled ? "text-ok" : "text-muted"}>{m.twoFactorEnabled ? "On" : "Not yet"}</td>
                    <td>
                      <div className="flex gap-2 justify-end flex-wrap items-center">
                        {m.canManage ? (
                          <>
                            <label className="sr-only" htmlFor={`role-${m.userId}`}>Change role for {m.email}</label>
                            <select
                              id={`role-${m.userId}`}
                              className="input min-h-[36px] w-auto"
                              value={m.role ?? ""}
                              onChange={(e) => ask({ label: "Role changed", description: `Change ${m.email} to ${ROLE_LABEL[e.target.value as Role].toLowerCase()}? They'll be signed out of the portal.`, path: "/api/team/role", body: { userId: m.userId, role: e.target.value } })}
                            >
                              {offerable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          </>
                        ) : null}
                        {m.addReader === "self" ? (
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Reader role added", description: "Add the reader role to your own account? You'll accept the reader guidelines in the app before using Desk.", path: "/api/readers/add-self", body: {} })}>Add reader role</button>
                        ) : m.addReader === "offer" ? (
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Offer sent", description: `Offer the reader role to ${m.email}? It starts when they accept in the app.`, path: "/api/readers/offer", body: { userId: m.userId, reader: true, portalRole: null } })}>Add reader role</button>
                        ) : null}
                        {m.canRemoveReader ? (
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Reader role removed", description: `Remove the reader role from ${m.userId === me.id ? "your account" : m.email}? Their log is locked, not deleted; giving the role back unlocks it.`, path: "/api/readers/remove", body: { userId: m.userId } })}>Remove reader role</button>
                        ) : null}
                        {m.canOfferAgain ? (
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Offer sent", description: `Offer the reader role to ${m.email} again?`, path: "/api/readers/offer", body: { userId: m.userId, reader: true, portalRole: null } })}>Offer reader role again</button>
                        ) : null}
                        {m.canManage ? (
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Removed", description: `Remove ${m.email} from the team? Their account stays; they lose this role and are signed out of the portal.`, path: "/api/team/remove", body: { userId: m.userId } })}>Remove</button>
                        ) : null}
                        {m.role === "owner" && !m.addReader && !m.canRemoveReader ? <span className="text-[13px] text-muted">Can&apos;t be removed</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>{o.email}<br /><span className="text-xs text-muted">Existing account · offered</span></td>
                    <td><Badge kind="role">{offerWords(o)}</Badge></td>
                    <td>Offer sent · {expires(o.expiresAt)}</td>
                    <td className="text-muted">—</td>
                    <td>
                      {o.canWithdraw ? (
                        <div className="flex gap-2 justify-end">
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Offer withdrawn", description: `Withdraw the offer to ${o.email}?`, path: "/api/readers/revoke-offer", body: { offerId: o.id } })}>Withdraw offer</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}<br /><span className="text-xs text-muted">Invited</span></td>
                    <td><Badge kind="role">{ROLE_LABEL[i.role]}</Badge></td>
                    <td>Invite sent · {expires(i.expiresAt)}</td>
                    <td className="text-muted">Not yet</td>
                    <td>
                      {i.canCancel ? (
                        <div className="flex gap-2 justify-end">
                          <button type="button" className="btn min-h-[36px]" onClick={() => ask({ label: "Invite cancelled", description: `Cancel the invitation for ${i.email}?`, path: "/api/team/revoke", body: { inviteId: i.id } })}>Cancel invite</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel p-5 flex flex-col gap-3" aria-labelledby="matrix-h">
          <h2 id="matrix-h" className="m-0 text-base font-semibold">What each role can do</h2>
          <div className="overflow-x-auto">
            <table className="grid min-w-[640px]">
              <thead><tr><th scope="col"><span className="sr-only">Permission</span></th><th scope="col">Owner</th><th scope="col">Admin</th><th scope="col">Moderator</th><th scope="col">Reader (app)</th></tr></thead>
              <tbody>
                {MATRIX.map(([what, ...cells]) => (
                  <tr key={what}>
                    <th scope="row" className="!normal-case !tracking-normal !text-sm !text-moon">{what}</th>
                    {cells.map((c, i) => <td key={i} className={c === "—" ? "text-muted" : ""}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel flex-[1_1_300px] max-w-[380px] box-border p-5 flex flex-col gap-4" aria-labelledby="add-h">
        <h2 id="add-h" className="m-0 text-base font-semibold">Add someone</h2>
        <div role="group" aria-label="How to add" className="flex gap-1 p-1 rounded-[10px] bg-deep">
          {(["invite", "existing"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setFormError(null); }} className={`flex-1 min-h-[40px] rounded-lg text-[13px] ${mode === k ? "bg-nebula text-moon font-semibold" : "text-haze"}`}>
              {k === "invite" ? "Invite by email" : "Existing account"}
            </button>
          ))}
        </div>
        {mode === "invite" ? (
          <form onSubmit={invite} className="flex flex-col gap-4">
            <div className="field">
              <label htmlFor="invite-email">Their email</label>
              <input id="invite-email" name="email" type="email" required maxLength={254} placeholder="name@example.com" className="input" />
            </div>
            <div className="field">
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" name="role" className="input" defaultValue="reader">
                {grantable.map((r) => <option key={r} value={r}>{r === "reader" ? "Reader (works in the app)" : ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <FormError message={formError} />
            <button type="submit" className="btn btn-gold">Send invite</button>
            <p className="m-0 text-[13px] text-muted leading-relaxed">The invitation link works for 72 hours. Their role starts only after they&apos;ve signed in with that email and turned on an authenticator. Sending asks for your authenticator code.</p>
          </form>
        ) : (
          <form onSubmit={offerExisting} className="flex flex-col gap-4">
            <div className="field">
              <label htmlFor="offer-email">Account email (exact)</label>
              <input id="offer-email" name="email" type="email" required maxLength={254} placeholder="name@example.com" className="input" />
            </div>
            <div className="field">
              <label htmlFor="offer-portal">Portal role</label>
              <select id="offer-portal" name="portalRole" className="input" defaultValue="">
                <option value="">None (reader only)</option>
                {offerable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <label className="flex gap-2.5 items-start text-sm leading-snug">
              <input type="checkbox" name="reader" defaultChecked className="w-[18px] h-[18px] mt-0.5 accent-gold flex-none" />
              Reader: answers questions and keeps a private log in the app
            </label>
            <FormError message={formError} />
            <button type="submit" className="btn btn-gold">Send offer</button>
            <p className="m-0 text-[13px] text-muted leading-relaxed">They get an email with a link to the offer. The role starts only after they accept and turn on an authenticator. Sending asks for your authenticator code and is written to the audit log.</p>
            <p className="m-0 text-[13px] text-muted leading-relaxed">You can also start this from Users: find someone&apos;s account and choose &quot;Offer a role&quot;.</p>
          </form>
        )}
        <p className="m-0 p-3 rounded-[10px] bg-deep text-[13px] text-haze leading-relaxed">Anyone can be a reader: an ordinary user, or staff alongside their portal role (only the owner gives staff the reader role). Each reader&apos;s log stays private to them, even from the owner. Removing the reader role locks their log; giving it back unlocks it.</p>
        <p className="m-0 p-3 rounded-[10px] bg-deep text-[13px] text-haze leading-relaxed">Staff also need their email added to Cloudflare Access to open the portal. Readers don&apos;t: they work in the app.</p>
      </section>
      <StepUpDialog open={pending !== null} description={pending?.description ?? ""} confirmLabel="Confirm" onConfirm={confirm} onCancel={() => setPending(null)} />
    </div>
  );
}
