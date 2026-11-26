import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { SetupTwoStep } from "@/components/SetupTwoStep";
import { getStaff } from "@/lib/auth";

export const metadata = { title: "Set up 2-step sign-in" };
export const dynamic = "force-dynamic";

export default async function SetupTwoStepPage() {
  const staff = await getStaff(await headers());
  if (!staff) redirect("/sign-in");
  if (staff.twoFactorEnabled) redirect("/");
  return (
    <AuthCard title="Set up 2-step sign-in" lede="Staff must use an authenticator app. You'll enter a code from it each time you sign in, and before sensitive changes.">
      <SetupTwoStep />
    </AuthCard>
  );
}
