import { getCopy } from "@/lib/copy";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DrawThree } from "@/components/draw/DrawThree";
import { getSessionUser } from "@/lib/auth";

export async function generateMetadata() {
  return { title: (await getCopy())("app.draw.three_meta") };
}

export default async function DrawThreePage() {
  if (!(await getSessionUser(await headers()))) redirect("/sign-up");
  return (
    <AppShell current="today">
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 pb-28 pt-5 lg:max-w-none lg:pb-16 lg:pt-2">
        <DrawThree />
      </div>
    </AppShell>
  );
}
