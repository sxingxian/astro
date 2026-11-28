import { formatDate, weekdayOf } from "@astro/copy/dates";
export type DayPart = "morning" | "afternoon" | "evening";
const partOf = (hour: number): DayPart => (hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening");

/** The part of the day and "Friday · 27 Nov 2026", in `timeZone` (or the runtime's own zone when null). */
export function localGreeting(timeZone: string | null, now: Date = new Date()): { part: DayPart; day: string } {
  const opts = timeZone ? { timeZone } : {};
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", ...opts }).format(now));
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  return { part: partOf(hour), day: `${weekdayOf(now, zone)} · ${formatDate(now, zone)}` };
}
