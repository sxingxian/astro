import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { SignInForm } from "@/components/SignInForm";
import { getStaff } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getStaff(await headers())) redirect("/");
  const env = getEnv();
  return (
    <AuthCard step="Step 1 of 2" title="Sign in" lede="For invited staff only. There's no sign-up here.">
      <SignInForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} appUrl={env.APP_URL} />
    </AuthCard>
  );
}
