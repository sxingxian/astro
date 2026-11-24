import type { CSSProperties } from "react";

export function CardBack({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`card-back ${className}`} style={style} />;
}
