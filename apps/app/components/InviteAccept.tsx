"use client";

import { useEffect, useState } from "react";
import type { AppKey } from "@astro/copy";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { postJson } from "@/lib/client";
import { clearPendingInvite, pendingInvite, savePendingInvite } from "@/lib/invite-client";

interface Props {
  signedIn: boolean;
  email: string | null;
  twoFactorEnabled: boolean;
  adminUrl: string | null;
}

const REASONS: Record<string, AppKey> = {
  invalid: "app.invite.invalid",
  expired: "app.invite.expired",
  wrong_email: "app.invite.wrong_email",
  two_step_required: "app.invite.two_step_required",
  has_role: "app.invite.has_role"
};
const ROLE_NAME: Record<string, AppKey> = { admin: "app.invite.role_admin", moderator: "app.invite.role_moderator" };

function Steps({ current }: { current: 0 | 1 | 2 }) {
  const t = useT();
  const labels = [t("app.invite.step_account"), t("app.invite.step_authenticator"), t("app.invite.step_ready")];
  return (
    <ol aria-label={t("app.invite.steps_label")} className="m-0 p-0 list-none grid grid-cols-3 gap-2 text-xs text-muted">
      {labels.map((l, i) => (
        <li key={l} aria-current={i === current ? "step" : undefined} className={`flex flex-col gap-1.5 ${i === current ? "text-moon" : ""}`}>
          <span className={`h-[3px] rounded-sm ${i <= current ? "bg-gold" : "bg-nebula"}`} />
          {l}{i < current ? " ✓" : ""}
        </li>
      ))}
    </ol>
  );
}

/** Shows a wording entry with the signed-in email highlighted where its {email} goes. */
function Filled({ text, email }: { text: string; email: string | null }) {
  const [before, after = ""] = text.split("{email}");
  return <>{before}<span className="text-moon">{email}</span>{after}</>;
}

/** Accepting a team invitation in the app (mockup "P3 · Accept invite"). The token comes from the link's #fragment. */
export function InviteAccept({ signedIn, email, twoFactorEnabled, adminUrl }: Props) {
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fromLink = window.location.hash.slice(1);
    if (/^[A-Za-z0-9_-]{43}$/.test(fromLink)) {
      savePendingInvite(fromLink);
      history.replaceState(null, "", window.location.pathname);
    }
    setToken(pendingInvite());
    setReady(true);
  }, []);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const res = await postJson<{ role: string }>("/api/invite/accept", { token });
    setBusy(false);
    if (res.ok) {
      clearPendingInvite();
      return setRole(res.data.role);
    }
    if (res.data.error === "invalid" || res.data.error === "expired") clearPendingInvite();
    const reason = REASONS[res.data.error ?? ""];
    setError(t(reason ?? "app.common.went_wrong"));
  }

  if (!ready) return null;
  if (role)
    return (
      <div className="flex flex-col gap-5">
        <Steps current={2} />
        <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.invite.done_title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">
          {role === "reader"
            ? t("app.invite.done_reader")
            : t("app.invite.done_staff", { role: ROLE_NAME[role] ? t(ROLE_NAME[role]) : role })}
        </p>
        {role !== "reader" && adminUrl ? <a className="btn-gold" href={adminUrl}>{t("app.invite.open_portal")}</a> : <a className="btn-ghost" href="/today">{t("app.invite.go_today")}</a>}
      </div>
    );
  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.invite.incomplete_title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.invite.incomplete_text")}</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-5">
      <Steps current={!signedIn ? 0 : !twoFactorEnabled ? 1 : 2} />
      <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.invite.title")}</h1>
      {!signedIn ? (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze">{t("app.invite.sign_in_text")}</p>
          <a className="btn-gold" href="/sign-in">{t("app.invite.sign_in")}</a>
          <a className="btn-ghost" href="/sign-up">{t("app.invite.create")}</a>
        </>
      ) : !twoFactorEnabled ? (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze"><Filled text={t("app.invite.need_two_step")} email={email} /></p>
          <a className="btn-gold" href="/account#two-step">{t("app.tfa.turn_on")}</a>
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze"><Filled text={t("app.invite.ready_text")} email={email} /></p>
          <FormError message={error} />
          <button type="button" className="btn-gold" disabled={busy} onClick={accept}>{busy ? t("app.invite.accept_busy") : t("app.invite.accept")}</button>
        </>
      )}
    </div>
  );
}
