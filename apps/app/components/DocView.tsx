import { safeHref, type Doc, type Inline } from "@astro/copy";
import type { ReactNode } from "react";

function Run({ r }: { r: Inline }) {
  let node: ReactNode = r.text;
  if (r.b) node = <strong>{node}</strong>;
  if (r.i) node = <em>{node}</em>;
  const href = r.href ? safeHref(r.href) : null;
  if (href) node = href.startsWith("mailto:") ? <a href={href}>{node}</a> : <a href={href} target="_blank" rel="noopener noreferrer">{node}</a>;
  return <>{node}</>;
}

const Runs = ({ runs }: { runs: Inline[] }) => <>{runs.map((r, i) => <Run key={i} r={r} />)}</>;

/** Renders a saved document as React elements. Nothing in it can become HTML or script. */
export function DocView({ doc }: { doc: Doc }) {
  return (
    <div className="doc flex flex-col gap-4 leading-relaxed text-haze">
      {doc.blocks.map((b, i) => {
        switch (b.t) {
          case "h2": return <h2 key={i} className="m-0 mt-4 font-display text-3xl font-medium text-moon"><Runs runs={b.c} /></h2>;
          case "h3": return <h3 key={i} className="m-0 mt-2 text-lg font-semibold text-moon"><Runs runs={b.c} /></h3>;
          case "p": return <p key={i} className="m-0"><Runs runs={b.c} /></p>;
          case "quote": return <blockquote key={i} className="m-0 border-l-2 border-gold/40 pl-4 italic"><Runs runs={b.c} /></blockquote>;
          case "callout": return <aside key={i} className="rounded-xl border border-gold/20 bg-ink p-4"><Runs runs={b.c} /></aside>;
          case "ul": return <ul key={i} className="m-0 flex flex-col gap-1.5 pl-5">{b.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</ul>;
          case "ol": return <ol key={i} className="m-0 flex flex-col gap-1.5 pl-5">{b.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</ol>;
          case "divider": return <hr key={i} className="my-2 border-0 border-t border-gold/15" />;
        }
      })}
    </div>
  );
}
