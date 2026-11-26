import { Brand } from "@/components/Brand";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen flex flex-col items-center gap-10 px-6 py-16 outline-none">
      <div className="flex items-center gap-3">
        <Brand size={34} />
        <span className="text-xs text-muted px-2.5 py-0.5 rounded-full border border-gold/25">Admin</span>
      </div>
      <section className="panel w-full max-w-[460px] p-8 flex flex-col gap-5" aria-labelledby="s1">
        <h1 id="s1" className="serif text-[34px] font-semibold m-0">Sign in</h1>
        <p className="m-0 text-sm text-muted">For invited staff only. There&apos;s no sign-up here.</p>
      </section>
    </main>
  );
}
