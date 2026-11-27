"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AppKey } from "@astro/copy";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { postJson } from "@/lib/client";
import { clearPendingOffer } from "@/lib/invite-client";

const REASONS: Record<string, AppKey> = {
  invalid: "app.offer.expired",
  expired: "app.offer.expired",
  two_step_required: "app.invite.two_step_required",
  has_role: "app.offer.has_role",
  staff_reader_owner_only: "app.offer.owner_only",
  guidelines_changed: "app.offer.guidelines_changed"
};

function Step({ n, done, children }: { n: number; done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed">
      <span aria-hidden="true" className={`flex size-[26px] flex-none items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-ok text-night" : "border border-gold text-gold"}`}>{done ? "✓" : n}</span>
      <span className="flex flex-col gap-3">{children}</span>
    </li>
  );
}

/** Accepting a role offer (mockup "P4 · Role offer"). The guidelines document comes in as children, rendered on the server. */
export function OfferAccept(props: { offerId: string; reader: boolean; portalRole: string | null; title: string; text: string; expires: string; twoFactorEnabled: boolean; guidelinesVersion: number; adminUrl: string | null; children?: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reader: boolean; portal: string | null } | null>(null);
  useEffect(() => clearPendingOffer(), []);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await postJson<{ reader: boolean; portal: string | null }>("/api/offer/accept", { offerId: props.offerId, guidelines: props.guidelinesVersion });
    setBusy(false);
    if (res.ok) return setDone(res.data);
    setError(t(REASONS[res.data.error ?? ""] ?? "app.common.went_wrong"));
    if (res.data.error === "guidelines_changed") {
      setAgreed(false);
      router.refresh(); // loads the newly published guidelines and their version
    }
  }

  if (done)
    return (
      <div className="flex flex-col gap-5">
        <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.offer.done_title")}</h1>
        {done.reader ? <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.done_reader")}</p> : null}
        {done.portal ? <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.done_staff")}</p> : null}
        {done.reader ? <a className="btn-gold" href="/desk">{t("app.offer.open_desk")}</a> : null}
        {done.portal && props.adminUrl ? <a className={done.reader ? "btn-ghost" : "btn-gold"} href={props.adminUrl}>{t("app.invite.open_portal")}</a> : null}
      </div>
    );

  const ready = props.twoFactorEnabled && (!props.reader || agreed);
  return (
    <div className="flex flex-col gap-5">
      <span className="eyebrow">{t("app.offer.eyebrow")}</span>
      <h1 className="m-0 font-display text-[36px] font-medium leading-tight">{props.title}</h1>
      <p className="m-0 text-[15px] leading-relaxed text-haze">{props.text}</p>
      <ol aria-label={t("app.offer.steps_label")} className="m-0 flex list-none flex-col gap-4 rounded-2xl border border-gold/15 bg-[rgba(20,20,42,.85)] p-4">
        <Step n={1} done>{t("app.offer.step_signed_in")}</Step>
        <Step n={2} done={props.twoFactorEnabled}>
          {t("app.offer.step_authenticator")}
          {props.twoFactorEnabled ? null : <a className="btn-ghost self-start" href="/account#two-step">{t("app.offer.set_up_authenticator")}</a>}
        </Step>
        {props.reader ? (
          <Step n={3} done={agreed}>
            {t("app.offer.step_guidelines")}
            {props.children}
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-[18px] flex-none accent-gold" />
              {t("app.offer.agree")}
            </label>
          </Step>
        ) : null}
      </ol>
      <FormError message={error} />
      <button type="button" className="btn-gold" disabled={!ready || busy} onClick={accept}>{busy ? t("app.offer.accept_busy") : t("app.offer.accept")}</button>
      <a className="btn-ghost" href="/today">{t("app.offer.no_thanks")}</a>
      <p className="m-0 text-center text-xs leading-relaxed text-muted">{props.expires}</p>
    </div>
  );
}
