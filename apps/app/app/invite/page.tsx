import { headers } from "next/headers";
import { DocView } from "@/components/DocView";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { InviteAccept } from "@/components/InviteAccept";
import { getSessionUser } from "@/lib/auth";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { loadLegalPage } from "@/lib/legal";

export async function generateMetadata() {
  return { title: (await getCopy())("app.invite.meta") };
}
export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const user = await getSessionUser(await headers());
  const [t, guidelines] = await Promise.all([getCopy(), user?.twoFactorEnabled ? loadLegalPage(getDb(), "guidelines", null, { cache: false }) : null]);
  return (
    <div className="mx-auto flex min-h-screen max-w-[440px] flex-col gap-6 px-6 py-12">
      <span className="font-display text-2xl font-semibold">Astro</span>
      <div className="panel p-7">
        <InviteAccept signedIn={Boolean(user)} email={user?.email ?? null} twoFactorEnabled={Boolean(user?.twoFactorEnabled)} adminUrl={getEnv().ADMIN_URL ?? null} guidelinesVersion={guidelines?.version ?? 0}>
          {guidelines ? <GuidelinesBox label={t("app.legal.guidelines_meta")}><DocView doc={guidelines.doc} /></GuidelinesBox> : null}
        </InviteAccept>
      </div>
    </div>
  );
}
