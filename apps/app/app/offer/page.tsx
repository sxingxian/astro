import { headers } from "next/headers";
import { DocView } from "@/components/DocView";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { OfferAccept } from "@/components/OfferAccept";
import { RememberOffer } from "@/components/RememberOffer";
import { getSessionUser } from "@/lib/auth";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { loadLegalPage } from "@/lib/legal";
import { pendingOffer, readerStatus } from "@/lib/readers";

export async function generateMetadata() {
  return { title: (await getCopy())("app.offer.meta") };
}
export const dynamic = "force-dynamic";

export default async function OfferPage() {
  const [t, user] = await Promise.all([getCopy(), getSessionUser(await headers())]);
  const db = getDb();
  const offer = user ? await pendingOffer(db, user.id) : null;
  let body;
  if (!user) {
    body = (
      <div className="flex flex-col gap-4">
        <RememberOffer />
        <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.offer.title_reader")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.sign_in_text")}</p>
        <a className="btn-gold" href="/sign-in">{t("app.offer.sign_in")}</a>
      </div>
    );
  } else if (!offer) {
    body = (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-[32px] leading-tight">{t("app.offer.none_title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.none_text")}</p>
        <a className="btn-ghost" href="/today">{t("app.invite.go_today")}</a>
      </div>
    );
  } else {
    // The version comes from the same read as the document shown, so "I agree" always means this wording.
    const [status, guidelines] = await Promise.all([readerStatus(db, user.id), offer.reader ? loadLegalPage(db, "guidelines", null, { cache: false }) : null]);
    const roles = [offer.portalRole ? t(offer.portalRole === "admin" ? "app.offer.role_admin" : "app.offer.role_moderator") : null, offer.reader ? t("app.offer.role_reader") : null].filter((r): r is string => Boolean(r));
    body = (
      <OfferAccept
        offerId={offer.id}
        reader={offer.reader}
        portalRole={offer.portalRole}
        title={t(offer.portalRole ? "app.offer.title_staff" : "app.offer.title_reader")}
        text={[t("app.offer.text", { email: user.email, roles: roles.join(` ${t("app.offer.and")} `) }), offer.reader ? t("app.offer.text_reader") : null].filter(Boolean).join(" ")}
        expires={t("app.offer.expires", { date: offer.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: user.timeZone || "UTC" }) })}
        twoFactorEnabled={Boolean(user.twoFactorEnabled)}
        guidelinesVersion={guidelines?.version ?? status.guidelinesVersion}
        adminUrl={getEnv().ADMIN_URL ?? null}
      >
        {guidelines ? <GuidelinesBox label={t("app.legal.guidelines_meta")}><DocView doc={guidelines.doc} /></GuidelinesBox> : null}
      </OfferAccept>
    );
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-6 px-6 py-12">
      <span className="font-display text-2xl font-semibold">Astro</span>
      <div className="panel p-7">{body}</div>
    </div>
  );
}
