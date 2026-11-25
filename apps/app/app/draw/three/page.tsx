import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DrawThree } from "@/components/draw/DrawThree";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Three pairs" };

export default async function DrawThreePage() {
  if (!(await getSessionUser(await headers()))) redirect("/sign-up");
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pb-16 pt-8">
      <a href="/today" className="px-5 text-sm">← Today</a>
      <DrawThree />
    </div>
  );
}
