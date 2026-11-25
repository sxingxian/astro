import type { CSSProperties } from "react";

interface Props {
  className?: string;
  style?: CSSProperties;
  anim?: string;
  data?: Record<string, string | number>;
}

export function CardBack({ className = "", style, anim, data }: Props) {
  const dataAttrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, String(v)]));
  return <div aria-hidden="true" className={`card-back ${className}`} style={style} data-anim={anim} {...dataAttrs} />;
}
