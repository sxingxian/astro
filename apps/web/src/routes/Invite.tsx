import type { Doc } from "@astro/copy";
import { DocView } from "@/components/DocView";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { InviteAccept } from "@/components/InviteAccept";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";

interface InviteData {
  signedIn: boolean;
  email: string | null;
  twoFactor: boolean;
  guidelines: { doc: Doc; version: number } | null;
  adminUrl: string | null;
}

/** Accepting a team invitation. The token stays in the link's #fragment and never reaches a server log. */
export default function InvitePage() {
  const { t } = useSession();
  useTitle(t("app.invite.meta"));
  const { data, error } = useData<InviteData>("/api/invite");
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  return (
    <div data-page className="flex max-w-[560px] flex-col gap-6">
      <div className="panel p-6 lg:p-8">
        <InviteAccept signedIn={data.signedIn} email={data.email} twoFactorEnabled={data.twoFactor} adminUrl={data.adminUrl} guidelinesVersion={data.guidelines?.version ?? 0}>
          {data.guidelines ? (
            <GuidelinesBox label={t("app.legal.guidelines_meta")}>
              <DocView doc={data.guidelines.doc} />
            </GuidelinesBox>
          ) : null}
        </InviteAccept>
      </div>
    </div>
  );
}
