import type { ReactNode } from "react";

export function AuthShell({ title, lede, children, footer }: { title: string; lede?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col gap-7 px-5 py-10">
      <a href="/today" className="flex items-center gap-2.5 text-moon no-underline">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.3" strokeLinejoin="round" /></svg>
        <span className="font-display text-2xl font-semibold">Astro</span>
      </a>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-4xl font-medium leading-tight">{title}</h1>
        {lede ? <p className="m-0 leading-relaxed text-haze">{lede}</p> : null}
      </div>
      {children}
      {footer ? <div className="text-sm text-haze">{footer}</div> : null}
    </div>
  );
}

export function CheckEmail({ title, lede, note, back }: { title: string; lede: string; note: string; back: string }) {
  return (
    <AuthShell title={title} lede={lede} footer={<a href="/sign-in">{back}</a>}>
      <p className="m-0 text-sm text-muted">{note}</p>
    </AuthShell>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="error-text m-0">{message}</p> : null;
}
