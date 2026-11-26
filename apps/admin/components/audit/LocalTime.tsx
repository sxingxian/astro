"use client";

import { useEffect, useState } from "react";

const fmt = (iso: string, timeZone?: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone });

/** A time in the reader's own time zone. The server renders UTC first, so nothing jumps if scripts are off. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => `${fmt(iso, "UTC")} UTC`);
  useEffect(() => setText(fmt(iso)), [iso]);
  return <time dateTime={iso}>{text}</time>;
}
