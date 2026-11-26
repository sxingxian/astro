"use client";

import { useEffect, useState } from "react";
import { FormError } from "./AuthShell";
import { postJson } from "@/lib/client";
import { clearPendingInvite, pendingInvite, savePendingInvite } from "@/lib/invite-client";

interface Props {
  signedIn: boolean;
  email: string | null;
  twoFactorEnabled: boolean;
  adminUrl: string | null;
}

const REASONS: Record<string, string> = {
  invalid: "This invitation has already been used or was cancelled. Ask for a new one.",
  expired: "This invitation has expired. Ask for a new one.",
  wrong_email: "This invitation was sent to a different email address. Sign out, then sign in with the invited email.",
  two_step_required: "Turn on 2-step sign-in first, then come back here.",
  has_role: "Your account already has a role on Astro's team."
};

function Steps({ current }: { current: 0 | 1 | 2 }) {
  const labels = ["Account", "Authenticator", "Ready"];
  return (
    <ol aria-label="Steps" className="m-0 p-0 list-none grid grid-cols-3 gap-2 text-xs text-muted">
      {labels.map((l, i) => (
        <li key={l} aria-current={i === current ? "step" : undefined} className={`flex flex-col gap-1.5 ${i === current ? "text-moon" : ""}`}>
          <span className={`h-[3px] rounded-sm ${i <= current ? "bg-gold" : "bg-nebula"}`} />
          {l}{i < current ? " ✓" : ""}
        </li>
      ))}
    </ol>
  );
}

/** Accepting a team invitation in the app (mockup "P3 · Accept invite"). The token comes from the link's #fragment. */
export function InviteAccept({ signedIn, email, twoFactorEnabled, adminUrl }: Props) {
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
    setError(REASONS[res.data.error ?? ""] ?? "Something went wrong. Please try again.");
  }

  if (!ready) return null;
  if (role)
    return (
      <div className="flex flex-col gap-5">
        <Steps current={2} />
        <h1 className="m-0 font-display text-[32px] leading-tight">You&apos;re on the team</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">
          {role === "reader"
            ? "You're now a reader. Reading requests will appear in the app when paid readings launch."
            : `Your ${role} access is ready. Sign in to the admin portal with this account.`}
        </p>
        {role !== "reader" && adminUrl ? <a className="btn-gold" href={adminUrl}>Open the admin portal</a> : <a className="btn-ghost" href="/today">Go to Today</a>}
      </div>
    );
  if (!token)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-[32px] leading-tight">Invitation link incomplete</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">Open the link from your invitation email again. If it still doesn&apos;t work, ask for a new invitation.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-5">
      <Steps current={!signedIn ? 0 : !twoFactorEnabled ? 1 : 2} />
      <h1 className="m-0 font-display text-[32px] leading-tight">You&apos;re invited to join Astro&apos;s team</h1>
      {!signedIn ? (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze">Sign in with the email address the invitation was sent to, or create an account with it. You&apos;ll come back here afterwards.</p>
          <a className="btn-gold" href="/sign-in">Sign in</a>
          <a className="btn-ghost" href="/sign-up">Create an account</a>
        </>
      ) : !twoFactorEnabled ? (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze">Team members must use an authenticator app. Signed in as <span className="text-moon">{email}</span>. Turn on 2-step sign-in in your account, then come back here.</p>
          <a className="btn-gold" href="/account#two-step">Turn on 2-step sign-in</a>
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-haze">Signed in as <span className="text-moon">{email}</span> with 2-step sign-in on.</p>
          <FormError message={error} />
          <button type="button" className="btn-gold" disabled={busy} onClick={accept}>{busy ? "Accepting…" : "Accept invitation"}</button>
        </>
      )}
    </div>
  );
}
