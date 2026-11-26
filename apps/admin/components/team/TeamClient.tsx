"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "../FormError";
import { StepUpDialog } from "../StepUpDialog";
import { postJson } from "@/lib/client";

type Role = "owner" | "admin" | "moderator" | "reader";

interface Member {
  userId: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  grantedAt: string;
  canManage: boolean;
}
interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  canCancel: boolean;
}

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", reader: "Reader (app)" };

const MATRIX: [string, string, string, string, string][] = [
  ["Card meanings", "Edit", "View", "—", "View"],
  ["Other text, site settings", "Edit", "Edit", "—", "—"],
  ["AI services and keys", "Edit", "—", "—", "—"],
  ["Invite and remove people", "Everyone", "Moderators, readers", "—", "—"],
  ["Help users (disable, reset 2-step)", "Yes", "Yes", "Yes", "—"],
  ["Reading requests (plan 4)", "All", "All", "All", "Own only"],
  ["Audit log", "View", "View", "—", "—"]
];

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

type Pending = { label: string; description: string; path: string; body: Record<string, unknown> };

export function TeamClient({ me, grantable, members, invites }: { me: { id: string; role: Role }; grantable: Role[]; members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    setFormError(
      res.data.error === "has_role" ? "That person already has a role." : res.data.error === "forbidden_role" ? "Your role can't do that." : res.data.error === "invalid_input" ? "Check the email address." : "Something went wrong. Please try again."
    );
    return null;
  }

  function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const role = String(f.get("role") ?? "reader");
    setFormError(null);
    setNotice(null);
    setPending({ label: "Invite sent", description: `Send an invitation to ${email} as ${ROLE_LABEL[role as Role].toLowerCase()}?`, path: "/api/team/invite", body: { email, role } });
  }

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
        {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
        <section className="panel p-2" aria-labelledby="people-h">
          <h2 id="people-h" className="m-0 px-3 pt-3 pb-1 text-base font-semibold">People</h2>
          <div className="overflow-x-auto">
            <table className="grid min-w-[640px]">
              <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">2-step</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td>{m.email}{m.userId === me.id ? <><br /><span className="text-xs text-muted">You</span></> : null}</td>
                    <td><span className={`inline-flex items-center min-h-[26px] px-2.5 rounded-full text-xs font-semibold ${m.role === "owner" ? "bg-gold text-night" : "bg-nebula text-moon"}`}>{ROLE_LABEL[m.role]}</span></td>
                    <td>Active</td>
                    <td className={m.twoFactorEnabled ? "text-ok" : "text-muted"}>{m.twoFactorEnabled ? "On" : "Not yet"}</td>
                    <td>
                      {m.canManage ? (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <label className="sr-only" htmlFor={`role-${m.userId}`}>Change role for {m.email}</label>
                          <select
                            id={`role-${m.userId}`}
                            className="input min-h-[36px] w-auto"
                            value={m.role}
                            onChange={(e) => setPending({ label: "Role changed", description: `Change ${m.email} to ${ROLE_LABEL[e.target.value as Role].toLowerCase()}? They'll be signed out of the portal.`, path: "/api/team/role", body: { userId: m.userId, role: e.target.value } })}
                          >
                            {grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                          <button type="button" className="btn min-h-[36px]" onClick={() => setPending({ label: "Removed", description: `Remove ${m.email} from the team? Their account stays; they lose this role and are signed out of the portal.`, path: "/api/team/remove", body: { userId: m.userId } })}>Remove</button>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted">{m.role === "owner" ? "Can't be removed" : ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}<br /><span className="text-xs text-muted">Invited</span></td>
                    <td><span className="inline-flex items-center min-h-[26px] px-2.5 rounded-full text-xs font-semibold bg-nebula text-moon">{ROLE_LABEL[i.role]}</span></td>
                    <td>Invite sent · expires in {daysLeft(i.expiresAt)} {daysLeft(i.expiresAt) === 1 ? "day" : "days"}</td>
                    <td className="text-muted">Not yet</td>
                    <td>
                      {i.canCancel ? (
                        <div className="flex gap-2 justify-end">
                          <button type="button" className="btn min-h-[36px]" onClick={() => setPending({ label: "Invite cancelled", description: `Cancel the invitation for ${i.email}?`, path: "/api/team/revoke", body: { inviteId: i.id } })}>Cancel invite</button>
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
      <section className="panel flex-[1_1_280px] max-w-[340px] box-border p-5 flex flex-col gap-4" aria-labelledby="invite-h">
        <h2 id="invite-h" className="m-0 text-base font-semibold">Invite someone</h2>
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
        </form>
        <p className="m-0 text-[13px] text-muted leading-relaxed">The invitation link works for 72 hours. Their role starts only after they&apos;ve signed in with that email and turned on an authenticator. Sending asks for your authenticator code.</p>
        <p className="m-0 p-3 rounded-[10px] bg-deep text-[13px] text-haze leading-relaxed">Staff also need their email added to Cloudflare Access to open the portal. Readers don&apos;t: they work in the app.</p>
      </section>
      <StepUpDialog open={pending !== null} description={pending?.description ?? ""} confirmLabel="Confirm" onConfirm={confirm} onCancel={() => setPending(null)} />
    </div>
  );
}
