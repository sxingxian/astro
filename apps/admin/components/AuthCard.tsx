import { Brand } from "./Brand";

/** The centred card used by sign-in, the authenticator step and 2-step setup. */
export function AuthCard({ step, title, lede, children }: { step?: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen flex flex-col items-center gap-10 px-6 py-16 outline-none">
      <div className="flex items-center gap-3">
        <Brand size={34} />
        <span className="text-xs text-muted px-2.5 py-0.5 rounded-full border border-gold/25">Admin</span>
      </div>
      <section className="panel w-full max-w-[460px] box-border p-8 flex flex-col gap-5" aria-labelledby="card-title">
        {step ? <span className="text-xs tracking-[0.08em] uppercase text-gold">{step}</span> : null}
        <h1 id="card-title" className="serif text-[34px] leading-tight font-semibold m-0">{title}</h1>
        <p className="m-0 text-sm text-muted leading-relaxed">{lede}</p>
        {children}
      </section>
    </main>
  );
}
