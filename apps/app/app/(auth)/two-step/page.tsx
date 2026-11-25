import { AuthShell } from "@/components/AuthShell";
import { TwoStepChallenge } from "@/components/TwoStepChallenge";

export const metadata = { title: "2-step sign-in" };

export default function TwoStepPage() {
  return (
    <AuthShell title="Enter your code" lede="Open your authenticator app and enter the 6-digit code for Astro." footer={<a href="/sign-in">Start again</a>}>
      <TwoStepChallenge />
    </AuthShell>
  );
}
