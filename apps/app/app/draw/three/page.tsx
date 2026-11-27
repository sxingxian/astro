import { getCopy } from "@/lib/copy";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DrawThree } from "@/components/draw/DrawThree";
import { getSessionUser } from "@/lib/auth";

export async function generateMetadata() {
  return { title: (await getCopy())("app.draw.three_meta") };
}

export default async function DrawThreePage() {
  if (!(await getSessionUser(await headers()))) redirect("/sign-up");
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pb-16 pt-8">
      <a href="/today" className="px-5 text-sm">{(await getCopy())("app.draw.back_today")}</a>
      <DrawThree />
    </div>
  );
}
