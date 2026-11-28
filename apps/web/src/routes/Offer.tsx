import type { Doc } from "@astro/copy";
import { DocView } from "@/components/DocView";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { OfferAccept } from "@/components/OfferAccept";
import { RememberOffer } from "@/components/RememberOffer";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { formatDate } from "@astro/copy/dates";

type OfferData =
  | { state: "signed_out" }
  | { state: "none" }
  | {
      state: "offer";
      offer: { id: string; reader: boolean; portalRole: "admin" | "moderator" | null; expiresAt: string };
      email: string;
      timeZone: string;
      twoFactor: boolean;
      guidelinesVersion: number;
      guidelines: { doc: Doc; version: number } | null;
      adminUrl: string | null;
    };

/** A role offer made to the signed-in account (reader, or a portal role). */
export default function OfferPage() {
  const { t } = useSession();
  useTitle(t("app.offer.meta"));
  const { data, error } = useData<OfferData>("/api/offer");
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;

  let body;
  if (data.state === "signed_out") {
    body = (
      <div className="flex flex-col gap-4">
        <RememberOffer />
        <h1 className="m-0 font-display text-[32px] font-medium leading-tight">{t("app.offer.title_reader")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.sign_in_text")}</p>
        <div className="actions">
          <a className="btn-gold" href="/sign-in">{t("app.offer.sign_in")}</a>
        </div>
      </div>
    );
  } else if (data.state === "none") {
    body = (
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-[32px] font-medium leading-tight">{t("app.offer.none_title")}</h1>
        <p className="m-0 text-sm leading-relaxed text-haze">{t("app.offer.none_text")}</p>
        <div className="actions">
          <a className="btn-ghost" href="/today">{t("app.invite.go_today")}</a>
        </div>
      </div>
    );
  } else {
    const { offer } = data;
    const roles = [offer.portalRole ? t(offer.portalRole === "admin" ? "app.offer.role_admin" : "app.offer.role_moderator") : null, offer.reader ? t("app.offer.role_reader") : null].filter((r): r is string => Boolean(r));
    body = (
      <OfferAccept
        offerId={offer.id}
        reader={offer.reader}
        portalRole={offer.portalRole}
        title={t(offer.portalRole ? "app.offer.title_staff" : "app.offer.title_reader")}
        text={[t("app.offer.text", { email: data.email, roles: roles.join(` ${t("app.offer.and")} `) }), offer.reader ? t("app.offer.text_reader") : null].filter(Boolean).join(" ")}
        expires={t("app.offer.expires", { date: formatDate(offer.expiresAt, data.timeZone || "UTC") })}
        twoFactorEnabled={data.twoFactor}
        guidelinesVersion={data.guidelinesVersion}
        adminUrl={data.adminUrl}
      >
        {data.guidelines ? (
          <GuidelinesBox label={t("app.legal.guidelines_meta")}>
            <DocView doc={data.guidelines.doc} />
          </GuidelinesBox>
        ) : null}
      </OfferAccept>
    );
  }
  return (
    <div data-page className="flex max-w-[560px] flex-col gap-6">
      <div className="panel p-6 lg:p-8">{body}</div>
    </div>
  );
}
