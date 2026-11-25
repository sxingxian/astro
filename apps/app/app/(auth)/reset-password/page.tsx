import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/ResetForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token || error)
    return (
      <AuthShell title="This link has expired" lede="Reset links work once and expire after an hour." footer={<a href="/sign-in">Back to sign in</a>}>
        <a className="btn-gold" href="/forgot-password">Send a new link</a>
      </AuthShell>
    );
  return (
    <AuthShell title="Choose a new password" lede="Use at least 12 characters. A short sentence works well.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
