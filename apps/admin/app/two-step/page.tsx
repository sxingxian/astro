import { AuthCard } from "@/components/AuthCard";
import { TwoStepChallenge } from "@/components/TwoStepChallenge";

export const metadata = { title: "Authenticator code" };
export const dynamic = "force-dynamic";

export default function TwoStepPage() {
  return (
    <AuthCard step="Step 2 of 2" title="Authenticator code" lede="Open your authenticator app and enter the 6-digit code for Astro.">
      <TwoStepChallenge />
    </AuthCard>
  );
}
