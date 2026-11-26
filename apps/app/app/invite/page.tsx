import { headers } from "next/headers";
import { InviteAccept } from "@/components/InviteAccept";
import { getSessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Accept invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const user = await getSessionUser(await headers());
  return (
    <div className="mx-auto flex min-h-screen max-w-[440px] flex-col gap-6 px-6 py-12">
      <span className="font-display text-2xl font-semibold">Astro</span>
      <div className="panel p-7">
        <InviteAccept signedIn={Boolean(user)} email={user?.email ?? null} twoFactorEnabled={Boolean(user?.twoFactorEnabled)} adminUrl={getEnv().ADMIN_URL ?? null} />
      </div>
    </div>
  );
}
