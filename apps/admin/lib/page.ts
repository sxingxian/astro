import { can, type Action } from "@astro/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaff, type Staff } from "./auth";

/** For a portal page: the signed-in staff member if their role allows `action`, otherwise null (show NoAccess). */
export async function pageStaff(action: Action): Promise<Staff | null> {
  const staff = await getStaff(await headers());
  if (!staff) redirect("/sign-in");
  if (!staff.twoFactorEnabled) redirect("/setup-2fa");
  return can(staff.role, action) ? staff : null;
}
