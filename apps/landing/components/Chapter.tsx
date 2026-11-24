import type { ReactNode } from "react";

export function ChapterIntro({ label, titleId, title, lede, align = "left", titleClass = "" }: {
  label: string;
  titleId: string;
  title: readonly string[] | string;
  lede?: ReactNode;
  align?: "left" | "center";
  titleClass?: string;
}) {
  const lines = typeof title === "string" ? [title] : title;
  const center = align === "center" ? "items-center text-center" : "";
  return (
    <div className={`flex flex-col gap-5 ${center}`}>
      <span className="chapter" data-anim="reveal">{label}</span>
      <h2 id={titleId} className={`h2 ${titleClass}`} data-anim="reveal">
        {lines.map((line, i) => (
          <span key={i} className="block">{line}</span>
        ))}
      </h2>
      {lede ? <p className={`lede ${align === "center" ? "text-center" : ""}`} data-anim="reveal">{lede}</p> : null}
    </div>
  );
}
