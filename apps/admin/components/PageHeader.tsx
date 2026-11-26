export function PageHeader({ title, lede, badge, children }: { title: string; lede?: string; badge?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/12 pb-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 text-[22px] font-semibold">{title}</h1>
          {badge ? <span className="pill">{badge}</span> : null}
        </div>
        {lede ? <span className="text-[13px] text-muted">{lede}</span> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </header>
  );
}
