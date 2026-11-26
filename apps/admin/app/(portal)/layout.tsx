import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getStaff } from "@/lib/auth";
import { navFor } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Every portal screen: signed-in staff with 2-step on, or off to sign-in or setup. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff(await headers());
  if (!staff) redirect("/sign-in");
  if (!staff.twoFactorEnabled) redirect("/setup-2fa");
  return (
    <div className="min-h-screen flex flex-wrap">
      <Sidebar items={navFor(staff.role)} email={staff.email} role={staff.role} />
      <div className="flex-[999_1_560px] min-w-0 flex flex-col">
        <main id="main" tabIndex={-1} className="px-8 py-7 flex flex-col gap-5 outline-none max-sm:px-4">{children}</main>
      </div>
    </div>
  );
}
